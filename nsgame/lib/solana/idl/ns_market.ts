/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/ns_market.json`.
 */
export type NsMarket = {
  "address": "4zwmmKAL83VQADqRwfXERvPU2e1K3vcPpqPN7DmTR7MT",
  "metadata": {
    "name": "nsMarket",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "createMarket",
      "discriminator": [
        103,
        226,
        97,
        235,
        200,
        188,
        251,
        254
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  114,
                  107,
                  101,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "marketId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "marketId",
          "type": "string"
        },
        {
          "name": "question",
          "type": "string"
        },
        {
          "name": "closesAt",
          "type": "i64"
        },
        {
          "name": "feeBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "placeBet",
      "discriminator": [
        222,
        62,
        67,
        220,
        63,
        166,
        126,
        33
      ],
      "accounts": [
        {
          "name": "bettor",
          "writable": true,
          "signer": true
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "bet",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "bettor"
              },
              {
                "kind": "arg",
                "path": "nonce"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "nonce",
          "type": "u64"
        },
        {
          "name": "outcome",
          "type": "u8"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "redeem",
      "discriminator": [
        184,
        12,
        86,
        149,
        70,
        196,
        97,
        225
      ],
      "accounts": [
        {
          "name": "bettor",
          "writable": true,
          "signer": true,
          "relations": [
            "bet"
          ]
        },
        {
          "name": "bet",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "bettor"
              },
              {
                "kind": "arg",
                "path": "nonce"
              }
            ]
          }
        },
        {
          "name": "market",
          "writable": true
        },
        {
          "name": "authority",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "nonce",
          "type": "u64"
        }
      ]
    },
    {
      "name": "resolveMarket",
      "discriminator": [
        155,
        23,
        80,
        173,
        46,
        74,
        23,
        239
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "market",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "winningOutcome",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "bet",
      "discriminator": [
        147,
        23,
        35,
        59,
        15,
        75,
        155,
        32
      ]
    },
    {
      "name": "market",
      "discriminator": [
        219,
        190,
        213,
        55,
        0,
        227,
        198,
        154
      ]
    }
  ],
  "events": [
    {
      "name": "betPlaced",
      "discriminator": [
        88,
        88,
        145,
        226,
        126,
        206,
        32,
        0
      ]
    },
    {
      "name": "betRedeemed",
      "discriminator": [
        13,
        227,
        66,
        252,
        84,
        177,
        17,
        132
      ]
    },
    {
      "name": "marketResolved",
      "discriminator": [
        89,
        67,
        230,
        95,
        143,
        106,
        199,
        202
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidOutcome",
      "msg": "Outcome must be 0 (YES) or 1 (NO)"
    },
    {
      "code": 6001,
      "name": "invalidAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6002,
      "name": "marketIdTooLong",
      "msg": "Market id exceeds 32 bytes"
    },
    {
      "code": 6003,
      "name": "marketIdEmpty",
      "msg": "Market id must not be empty"
    },
    {
      "code": 6004,
      "name": "questionTooLong",
      "msg": "Question exceeds 200 bytes"
    },
    {
      "code": 6005,
      "name": "marketResolved",
      "msg": "Market is already resolved"
    },
    {
      "code": 6006,
      "name": "marketNotResolved",
      "msg": "Market is not yet resolved"
    },
    {
      "code": 6007,
      "name": "alreadyRedeemed",
      "msg": "Bet has already been redeemed"
    },
    {
      "code": 6008,
      "name": "losingBet",
      "msg": "Bet is on the losing outcome"
    },
    {
      "code": 6009,
      "name": "noWinners",
      "msg": "No bets on the winning outcome"
    },
    {
      "code": 6010,
      "name": "unauthorized",
      "msg": "Caller is not the market authority"
    },
    {
      "code": 6011,
      "name": "marketClosed",
      "msg": "Market is closed to new bets"
    },
    {
      "code": 6012,
      "name": "feeTooHigh",
      "msg": "Fee must be <= 10_000 bps (100%)"
    }
  ],
  "types": [
    {
      "name": "bet",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bettor",
            "type": "pubkey"
          },
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "outcome",
            "type": "u8"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "redeemed",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "betPlaced",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bettor",
            "type": "pubkey"
          },
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "outcome",
            "type": "u8"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "betRedeemed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bettor",
            "type": "pubkey"
          },
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "payout",
            "type": "u64"
          },
          {
            "name": "fee",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "market",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "marketId",
            "type": "string"
          },
          {
            "name": "question",
            "type": "string"
          },
          {
            "name": "resolved",
            "type": "bool"
          },
          {
            "name": "winningOutcome",
            "type": "u8"
          },
          {
            "name": "totalPool",
            "type": "u64"
          },
          {
            "name": "yesPool",
            "type": "u64"
          },
          {
            "name": "noPool",
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "closesAt",
            "type": "i64"
          },
          {
            "name": "resolvedAt",
            "type": "i64"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "feeCollected",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "marketResolved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "market",
            "type": "pubkey"
          },
          {
            "name": "winningOutcome",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
