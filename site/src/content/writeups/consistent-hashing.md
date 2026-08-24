Take a cache of four servers and a key you want to store. The obvious way to
pick a server is `hash(key) % 4`. It is fast, it is stateless, every client
computes the same answer without talking to anyone, and it is correct.

Then a fifth server joins, the divisor becomes 5, and almost every key moves.

That is not a rounding error. Measured over the 2000 keys in the figure above,
going from four nodes to five moves **78% of them** under `hash % N`. Every one
of those keys is now looked up on a machine that does not have it, so every one
is a cache miss and a trip to the database, all at once. The cluster grew and
the thing it was protecting fell over.

The ring exists to make that number small.

## The mechanism

There are two steps, and keeping them separate is the entire idea.

**First, hash the key to a position.** Not to a server, to a point on a circle
of size 2^32. This is a property of the key and nothing else. It does not know
how many nodes exist, it does not change when one joins, and every client
computes it identically.

**Second, walk clockwise from that position** until you hit a node, and that
node owns the key. Nodes are placed on the same circle by hashing their names,
so they have positions too.

Press play on the figure and it does exactly this: the key drops out of the
middle onto its hashed position, then a marker sweeps clockwise until it meets
a replica, and that replica's colour is the answer.

The payoff is what happens when a node joins. It lands at one position on the
circle and claims the arc immediately before it, taking those keys from
whichever node held them. Every other key is untouched, because the walk it
performs did not change. Only the keys in the new node's arc move, and on
average that arc is 1/(N+1) of the ring.

Four nodes becoming five: **21% of keys move instead of 78%.** Both numbers are
in the panel beside the figure, computed over the same keys, so you can move
the sliders and watch the gap hold.

## The wrap

A key that hashes past the last node on the circle has nothing clockwise of it.
It belongs to the first node, because the circle closes.

This is the single most common bug in a consistent hashing implementation. A
binary search for "first position at or after this one" runs off the end of the
array and returns an index that does not exist, so every key in that final arc
silently gets no owner. With a few keys and a lot of nodes you can easily not
notice.

The default run in the figure includes one. Watch for the key whose trail
crosses twelve o'clock, and the note that appears under the trace when it does.
Only a minority of seeds produce a run containing a wrap at all, so this one was
picked deliberately.

## Why one position per node is not enough

Hashing four node names gives four points on a circle. Four random points do not
divide a circle evenly. One node ends up with a third of the ring and another
with a twentieth, and the load follows the arcs.

The fix is to place each node at many positions instead of one, by hashing
`node#0`, `node#1`, `node#2` and so on. These are **virtual nodes**, or
replicas, and they are the same physical machine appearing repeatedly around
the ring. With 8 replicas each, four nodes become 32 points, and 32 random
points divide a circle much more evenly than 4 do.

The measure is the coefficient of variation of the load: the standard deviation
of keys-per-node divided by the mean. It is scale free, so it stays comparable
as the key count changes, and lower is better. Averaged over 40 independent
node namings at 20,000 keys:

| virtual nodes | measured skew | 1/sqrt(V) |
|---|---|---|
| 1 | 0.791 | 1.000 |
| 2 | 0.540 | 0.707 |
| 4 | 0.408 | 0.500 |
| 8 | 0.273 | 0.354 |
| 16 | 0.195 | 0.250 |
| 24 | 0.148 | 0.204 |
| 60 | 0.095 | 0.129 |
| 200 | 0.054 | 0.071 |

It falls as roughly 1/sqrt(V), which is the useful thing to know: going from 1
replica to 100 buys a tenfold improvement, and going from 100 to 10,000 buys
another tenfold for a hundred times the memory. Real systems sit in the low
hundreds.

Drag the virtual nodes slider and the arcs visibly shatter from a few big
wedges into interleaved slivers. That is the same fact drawn instead of
tabulated.

## The bit that went wrong

The first version of this hashed with FNV-1a, which is a perfectly good hash,
and the ring came out broken in a way that nothing reported.

FNV-1a's last operation is `(h ^ lastByte) * PRIME`. Two strings sharing a
prefix therefore differ by a small integer multiple of that prime. Virtual node
names are exactly that shape:

```
n1#0  1598427531
n1#1  1581649912   diff -16777619  = -1.00 x FNV prime
n1#2  1631982769   diff  50332857  = +3.00 x FNV prime
n1#3  1615205150   diff -16777619  = -1.00 x FNV prime
```

Ten replicas of one node spanned **5.86%** of the ring where uniform placement
would span about 82%. So all the replicas of a node sat in a few tight clumps,
virtual nodes bought nothing, and load skew stopped falling as V rose.

Nothing failed. Keys were distributed fine, because keys are long and varied and
FNV-1a is only weak on short inputs sharing a prefix. The same function was
good enough for the `hash % N` comparison, which reads the low bits, and bad for
the ring, which reads the high bits as a position. One hash, two different
quality requirements, and only one of them was being tested.

Adding MurmurHash3's `fmix32` finalizer, five lines of shift-xor-multiply, fixed
it. Ten replicas then spanned 91.5% of the ring and skew tracked the table
above.

The tests did not catch this, and that is the more useful lesson. They asserted
that the hash "avalanches" by comparing five strings and taking a median gap,
and that skew was "low" by requiring it to be under 0.2 where theory said 0.071.
A clustering hash passes both. A test that a broken implementation satisfies is
not a test.

## Reading the figure

- **Key count** starts at 1. The scale is logarithmic, so most of the track
  covers the first twenty keys, which is where you can actually follow what is
  happening one key at a time. Every key gets routed, so 6 keys means 6 flights
  and 2000 means 2000.
- **At small key counts the numbers are wild**, and that is correct rather than
  broken. With 6 keys, churn can only be a multiple of 1/6, so it reads 33.3%
  instead of 20%, and two nodes can easily hold nothing at all. Drag the count
  up and watch the percentages settle onto the theory. That convergence is the
  point.
- **Node positions do not depend on the seed.** They come from hashing node
  names, so the seed slider re-rolls the keys and never the ring. The figure
  shows one particular ring, not the average of all possible rings.
