package main

import (
	"errors"
	"log"

	maelstrom "github.com/jepsen-io/maelstrom/demo/go"
)

func main() {
	node := maelstrom.NewNode()

	node.Handle("echo", func(msg maelstrom.Message) error {
		// TODO(human): unmarshal msg.Body, set type to "echo_ok", reply with node.Reply.
		return errors.New("TODO(human): echo handler not implemented")
	})

	if err := node.Run(); err != nil {
		log.Fatal(err)
	}
}
