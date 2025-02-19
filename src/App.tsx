import { useMachine } from "@xstate/react";
import shuffle from "lodash.shuffle";
import { twMerge } from "tailwind-merge";
import { setup, assign } from "xstate";
import { id } from "./utils/id";

const VALUES = "abcdef";
const COLORS = ["red", "green", "blue", "orange", "purple", "black", "gray"];
const CARDS = VALUES.split("").flatMap((value, i) => {
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
});

export default function App() {
  const [state, send] = useMachine(machine);

  return (
    <div className="space-y-2 p-4">
      <div className="flex gap-4">
        {state.context.players.map((player, position) => {
          const points = state.context.points[player.id] ?? 0;
          const isTurn = state.context.turn === position;

          return (
            <div
              key={player.id}
              className={twMerge(
                "flex gap-2 rounded px-4 py-2",
                isTurn && "bg-zinc-600",
              )}
            >
              <div>{player.name}</div>
              <div>{points}</div>
            </div>
          );
        })}
      </div>

      <div className="grid w-fit grid-cols-4 gap-2">
        {state.context.cards.map((card) => {
          const isSelected = state.context.guess
            .map((s) => s.id)
            .includes(card.id);

          const isGuessed = state.context.opened[card.value];

          const isVisible = isSelected || isGuessed;

          return (
            <button
              key={card.id}
              className="grid aspect-square w-24 overflow-hidden rounded border text-5xl font-bold uppercase [grid-template-areas:'stack']"
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
              style={{
                borderColor: card.color,
              }}
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
                      : "[transform:rotateY(90deg)] opacity-5",
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

      <button onClick={() => send({ type: "RESTART" })}>Restart</button>
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
  color?: string;
};

type Player = {
  id: string;
  name: string;
};

type Points = Record<Player["id"], number>;

type OpenedCards = Record<Card["id"], boolean>;

const PLAYERS: Player[] = ["Igor", "Nay"].map((name) => ({
  id: id(),
  name,
}));

type Event = { type: "GUESS"; guess: Guess } | { type: "RESTART" };
const machine = setup({
  types: {
    context: {} as {
      turn: number;
      players: Player[];
      points: Points;
      guess: Guess[];
      opened: OpenedCards;
      cards: Card[];
    },
    events: {} as Event,
  },
  actions: {
    update: assign(({ context }) => {
      const player = context.players[context.turn];
      if (!player) {
        throw new Error(`Invalid turn, could not find player ${context.turn}`);
      }

      if (context.guess.length === 2) {
        const [first, second] = context.guess;

        if (first.value === second.value) {
          return {
            points: {
              ...context.points,
              [player.id]: 1 + (context.points[player.id] ?? 0),
            },
            guess: [],
            opened: {
              ...context.opened,
              [first.value]: true,
            },
          };
        } else {
          return {
            turn: nextTurn(context.turn, context.players.length),
          };
        }
      }

      return context;
    }),
    guess: assign(({ context, event }) => {
      if (!isEventType(event, "GUESS")) {
        return context;
      }

      if (context.guess.length === 2) {
        if (context.players.length === 1) {
          return {
            guess: [context.guess[1], event.guess],
          };
        } else {
          return {
            guess: [event.guess],
          };
        }
      }

      return {
        guess: context.guess.concat(event.guess),
      };
    }),
    cleanup: assign(({ context }) => {
      if (context.guess.length === 1) {
        return context;
      }

      if (isGameOver(context.opened, CARDS.length)) {
        const winners = getWinners(context.players, context.points);
        console.log("GAME_OVER/winners", winners);
        return context;
      }

      return {
        guess: [],
      };
    }),
    restart: assign(({ event, context }) => {
      if (!isEventType(event, "RESTART")) {
        return context;
      }

      // TODO: start with the winner
      return {
        cards: shuffle(context.cards),
        points: {},
        guess: [],
        opened: {},
        turn: 0,
      };
    }),
  },
}).createMachine({
  id: "game-loop",
  context: {
    cards: shuffle(CARDS),
    turn: 0,
    players: PLAYERS,
    points: {},
    guess: [],
    opened: {},
  },
  initial: "loop",
  on: {
    GUESS: {
      target: ".updating",
      actions: ["guess"],
    },
    RESTART: {
      target: ".loop",
      actions: ["restart"],
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

function nextTurn(currentTurn: number, playersCount: number): number {
  return (currentTurn + 1) % playersCount;
}

function isEventType<T extends Event["type"]>(
  event: Event,
  type: T,
): event is Extract<Event, { type: T }> {
  return event.type === type;
}

function getWinners(players: Player[], points: Points): Player[] {
  let winners = [players[0]];
  let max = points[winners[0].id] ?? 0;

  for (let i = 1; i < players.length; i++) {
    const player = players[i];
    const playerPoints = points[player.id] ?? 0;
    if (playerPoints > max) {
      winners = [player];
    } else if (playerPoints === max) {
      winners.push(player);
    }
  }

  return winners;
}

function isGameOver(opened: OpenedCards, cardsCount: number): boolean {
  return Object.keys(opened).length * 2 === cardsCount;
}
