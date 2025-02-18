import { useMachine } from "@xstate/react";
import { setup } from "xstate";

export default function App() {
  const [state, send] = useMachine(machine);

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold">Vite + React + TS + Tailwind</h1>
      <pre>{JSON.stringify(state.toJSON(), null, 2)}</pre>
      <button onClick={() => send({ type: "UPDATE" })}>update</button>
    </div>
  );
}

const machine = setup({
  types: {
    context: {} as {},
    events: {} as { type: "UPDATE" },
  },
  actions: {
    update() {
      console.log("update");
    },
    cleanup() {
      console.log("cleanup");
    },
  },
}).createMachine({
  id: "game-loop",
  context: {},
  initial: "loop",
  states: {
    loop: {
      on: {
        UPDATE: {
          target: "updating",
        },
      },
    },
    updating: {
      after: {
        2000: {
          target: "wait",
        },
      },
      entry: {
        type: "update",
      },
    },
    wait: {
      always: {
        target: "loop",
      },
      entry: {
        type: "cleanup",
      },
    },
  },
});
