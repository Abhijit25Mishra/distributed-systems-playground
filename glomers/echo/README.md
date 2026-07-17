# Glomers — Echo

First [Gossip Glomers](https://fly.io/dist-sys/) challenge. The handler body is
a TODO — **hand-written boundary: the human fills it in.**

## Install Maelstrom (one-time)

Maelstrom needs a JDK and Graphviz:

```sh
brew install openjdk graphviz gnuplot
```

Download and unpack Maelstrom (v0.2.3 or newer):

```sh
mkdir -p ~/maelstrom && cd ~/maelstrom
curl -LO https://github.com/jepsen-io/maelstrom/releases/download/v0.2.3/maelstrom.tar.bz2
tar -xjf maelstrom.tar.bz2
```

## Run the echo test

```sh
cd glomers/echo
go build -o /tmp/glomers-echo .
~/maelstrom/maelstrom/maelstrom test -w echo --bin /tmp/glomers-echo --node-count 1 --time-limit 10
```

Pass = `Everything looks good! ヽ(‘ー`)ノ` at the end of the output.
