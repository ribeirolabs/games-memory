import { useMachine } from "@xstate/react";
import shuffle from "lodash.shuffle";
import { twMerge } from "tailwind-merge";
import { setup, assign } from "xstate";
import { id } from "./utils/id";

export default function App() {
  const [{ context }, send] = useMachine(machine);

  return (
    <div className="space-y-2 p-4">
      <div className="flex gap-4">
        {context.players.map((player, position) => {
          const points = context.points[player.id] ?? 0;
          const isTurn = context.turn === position;

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
        {context.cards.map((card) => {
          const isSelected = context.guess.map((s) => s.id).includes(card.id);
          const isGuessed = context.guessed[card.value];
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
                borderColor: card.data,
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
                  backgroundColor: card.data,
                }}
              >
                {card.value}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-4">
        <button onClick={() => send({ type: "RESTART" })}>Restart</button>
        <button
          onClick={() => send({ type: "REVEAL" })}
          disabled={!context.actions.reveal}
          className="disabled:opacity-40"
        >
          Reveal
        </button>
      </div>

      {context.winners.length > 0 ? (
        <h1 className="text-5xl">
          {context.winners.length > 1
            ? "Tie"
            : context.winners[0].name + " is the winner"}
        </h1>
      ) : null}
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

type Player = {
  id: string;
  name: string;
};

type Points = Record<Player["id"], number>;

type GuessedCards = Record<Card["id"], boolean>;

enum ScoreSystem {
  Time,
  Hits,
}

type GameConfig = {
  scoreSystem: ScoreSystem;
};

type GameContext = {
  turn: number;
  players: Player[];
  points: Points;
  guess: Guess[];
  guessed: GuessedCards;
  cards: Card[];
  winners: Player[];
  config: GameConfig;
  actions: {
    restart: boolean;
    reveal: boolean;
  };
};

type GameEvent =
  | { type: "GUESS"; guess: Guess }
  | { type: "RESTART" }
  | { type: "REVEAL" };

const machine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
  },
  actions: {
    update: assign(({ context }) => {
      if (context.guess.length === 2) {
        const [first, second] = context.guess;

        if (first.value === second.value) {
          return {
            points: getTurnPoints(context),
            guess: [],
            guessed: {
              ...context.guessed,
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
    guess: assign({
      guess: ({ context, event }) => {
        if (!isEventType(event, "GUESS")) {
          return context.guess;
        }

        // The logic below allows for fast gameplay, allowing players to keep
        // selecting cards regardless of the current selection
        if (context.guess.length === 2) {
          return context.players.length === 1
            ? // When it's single player we allow the player to keep selecting
              // cards, even if there are two cards selected already, by discarding
              // the first selection and using the last selection and the new one
              [context.guess[1], event.guess]
            : // When it's multi player we clear the guesses on the third click
              // by only using the current selection
              [event.guess];
        }

        return context.guess.concat(event.guess);
      },
    }),
    setWinners: assign({
      winners: ({ context }) => getWinners(context),
      guess: [],
    }),
    clearGuess: assign({
      guess: [],
    }),
    restart: assign(({ event, context }) => {
      if (!isEventType(event, "RESTART")) {
        return context;
      }

      return {
        cards: shuffle(context.cards),
        points: {},
        guess: [],
        winners: [],
        guessed: {},
        turn: getTurnFromWinner(context) ?? 0,
        actions: {
          restart: true,
          reveal: true,
        },
      };
    }),
    reveal: assign(({ context }) => {
      return {
        actions: {
          ...context.actions,
          reveal: false,
        },
        guessed: context.cards.reduce(
          (guessed, card) => {
            return {
              ...guessed,
              [card.value]: true,
            };
          },
          {} as GameContext["guessed"],
        ),
      };
    }),
    unreveal: assign({
      guessed: {},
    }),
  },
  guards: {
    isGameOver({ context }) {
      return isGameOver(context);
    },
    hasTotalGuesses({ context }, params: { total: number }) {
      return context.guess.length === params.total;
    },
    canReveal({ context }) {
      return context.actions.reveal;
    },
  },
}).createMachine({
  id: "game-loop",
  context: {
    cards: shuffle(getCards()),
    turn: 0,
    players: getPlayers(),
    points: {},
    guess: [],
    winners: [],
    guessed: {},
    actions: {
      reveal: true,
      restart: true,
    },
    config: {
      scoreSystem: ScoreSystem.Hits,
    },
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
    loop: {
      on: {
        REVEAL: {
          target: "reveal",
          guard: "canReveal",
        },
      },
    },
    updating: {
      after: {
        1000: [
          {
            target: "wait",
            guard: "isGameOver",
            actions: ["setWinners"],
          },
          {
            target: "wait",
            guard: { type: "hasTotalGuesses", params: { total: 2 } },
            actions: ["clearGuess"],
          },
          { target: "wait" },
        ],
      },
      entry: "update",
    },
    wait: {
      always: "loop",
    },
    reveal: {
      entry: "reveal",
      after: {
        3000: {
          target: "loop",
          actions: "unreveal",
        },
      },
    },
  },
});

function getCards(): Card[] {
  const VALUES = "abcdef";
  const COLORS = ["red", "green", "blue", "orange", "purple", "black", "gray"];
  return VALUES.split("").flatMap((value, i) => {
    const cards = [];
    for (let j = 0; j < 2; j++) {
      cards.push({
        id: id(),
        value,
        data: COLORS[i],
      });
    }
    return cards;
  });
}

function getPlayers(): Player[] {
  return ["Igor", "Nay", "Elis"].map((name) => ({
    id: id(),
    name,
  }));
}

function nextTurn(currentTurn: number, playersCount: number): number {
  return (currentTurn + 1) % playersCount;
}

function isEventType<T extends GameEvent["type"]>(
  event: GameEvent,
  type: T,
): event is Extract<GameEvent, { type: T }> {
  return event.type === type;
}

function getWinners(context: Readonly<GameContext>): Player[] {
  let winners = [context.players[context.turn]];
  let max = context.points[winners[0].id] ?? 0;

  for (let i = 0; i < context.players.length; i++) {
    if (i === context.turn) {
      continue;
    }

    const player = context.players[i];
    const playerPoints = context.points[player.id] ?? 0;

    if (playerPoints > max) {
      winners = [player];
    } else if (playerPoints === max) {
      winners.push(player);
    }
  }

  return winners;
}

function isGameOver(context: Readonly<GameContext>): boolean {
  return Object.keys(context.guessed).length * 2 === context.cards.length;
}

function getTurnFromWinner(context: Readonly<GameContext>): number | null {
  const positionByPlayer = context.players.reduce(
    (byPlayer, player, position) => {
      return {
        ...byPlayer,
        [player.id]: position,
      };
    },
    {} as Record<Player["id"], number>,
  );

  return positionByPlayer[context.winners[0]?.id] ?? null;
}

function getTurnPlayer(context: Readonly<GameContext>): Player {
  const player = context.players[context.turn];
  if (!player) {
    throw new Error(`Invalid turn, could not find player ${context.turn}`);
  }
  return player;
}

function getTurnPoints(context: Readonly<GameContext>): GameContext["points"] {
  const player = getTurnPlayer(context);
  const playerPoints = 1 + (context.points[player.id] ?? 0);
  return {
    ...context.points,
    [player.id]: playerPoints,
  };
}
