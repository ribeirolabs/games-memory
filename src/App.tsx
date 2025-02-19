import { useMachine } from "@xstate/react";
import shuffle from "lodash.shuffle";
import { twMerge } from "tailwind-merge";
import { setup, assign } from "xstate";

function id() {
  return window.crypto.randomUUID();
}

const VALUES = "abcdef";
const COLORS = ["red", "green", "blue", "orange", "purple", "black"];
const CARDS = shuffle(
  VALUES.split("").flatMap((value, i) => {
    const cards = [];
    for (let j = 0; j < 2; j++) {
      cards.push({
        id: id(),
        value,
        data: value,
        color: COLORS[i],
      });
    }
    return cards;
  }),
);

export default function App() {
  const [state, send] = useMachine(machine);

  return (
    <div className="p-4">
      <div className="grid w-fit grid-cols-4 gap-2">
        {CARDS.map((card) => {
          const isSelected = state.context.guess
            .map((s) => s.id)
            .includes(card.id);

          const isGuessed = state.context.opened[card.value];

          const isVisible = isSelected || isGuessed;

          return (
            <button
              key={card.id}
              className="grid aspect-square w-24 overflow-hidden text-5xl font-bold uppercase [grid-template-areas:'stack']"
              onClick={() =>
                send({
                  type: "GUESS",
                  guess: {
                    id: card.id,
                    value: card.value,
                  },
                })
              }
              disabled={isVisible}
            >
              <div
                className={twMerge(
                  "rounded bg-zinc-800 transition-opacity [grid-area:stack]",
                  isVisible ? "opacity-0" : "opacity-100",
                )}
              ></div>
              <div
                className={twMerge(
                  "flex items-center justify-center rounded transition-transform [grid-area:stack]",
                  isGuessed
                    ? "animate-correct-guess"
                    : isSelected
                      ? "[transform:rotateY(0)]"
                      : "[transform:rotateY(90deg)]",
                )}
                style={{
                  backgroundColor: card.color,
                }}
              >
                {card.data}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type Guess = {
  id: string;
  value: string;
};

type Card = {
  id: string;
  value: string;
  data: any;
};

const machine = setup({
  types: {
    context: {} as {
      guess: Guess[];
      opened: Record<Card["id"], boolean>;
    },
    events: {} as { type: "GUESS"; guess: Guess },
  },
  actions: {
    update: assign(({ context }) => {
      console.log("update");
      if (context.guess.length === 2) {
        const [first, second] = context.guess;

        if (first.value === second.value) {
          return {
            guess: [],
            opened: {
              ...context.opened,
              [first.value]: true,
            },
          };
        }
      }

      return context;
    }),
    guess: assign(({ context, event }) => {
      if (context.guess.length === 2) {
        return {
          guess: [context.guess[1], event.guess],
        };
      }

      return {
        guess: context.guess.concat(event.guess),
      };
    }),
    cleanup: assign(({ context }) => {
      if (context.guess.length === 1) {
        return context;
      }
      return {
        guess: [],
      };
    }),
  },
}).createMachine({
  id: "game-loop",
  context: {
    guess: [],
    opened: {},
  },
  initial: "loop",
  on: {
    GUESS: {
      target: ".updating",
      actions: ["guess"],
    },
  },
  states: {
    loop: {},
    updating: {
      after: {
        1000: {
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
