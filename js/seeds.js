/*
 * Empresas que vienen cargadas en la app. Se agregan una sola vez por navegador;
 * si las eliminas no vuelven a aparecer.
 */
window.SEED_COMPANIES = [
  {
    "id": "seed-googl",
    "ticker": "GOOGL",
    "name": "Alphabet Inc. (clase A)",
    "price": 165,
    "shares": 12134,
    "sector": "tech",
    "baseYear": 2025,
    "ratios": {
      "perHist": 23,
      "pfcfHist": 23,
      "per": 17.9,
      "pfcf": 24.8,
      "evEbitda": 11,
      "revCagr": 15.3,
      "epsCagr": 23,
      "ndE": -0.48,
      "roic": 31.9,
      "buyback": 2,
      "dividend": 0.5
    },
    "egm": {
      "epsGrowth": null,
      "safety": 0,
      "mode": "linear",
      "years": 10,
      "hurdle": 15
    },
    "eps": {
      "analyst": [
        9.6,
        10.2,
        11.56,
        13.54,
        null
      ],
      "per": 23,
      "baseEps": null,
      "cagr": null
    },
    "ps": {
      "revenue": 350018,
      "growth": [
        15,
        15,
        15,
        15,
        15
      ],
      "multiple": 5.5
    },
    "fcf": {
      "base": null,
      "growth": [
        null,
        null,
        null,
        null,
        null
      ],
      "multipleMode": "hist",
      "multiple": null
    },
    "graham": {
      "epsNtm": null,
      "perNtmOverride": null,
      "eps": null,
      "gExpected": null,
      "aaa": null
    },
    "course": {
      "assumptions": {
        "growth": 15,
        "ebitMargin": 33,
        "taxRate": 16.7,
        "buyback": null
      },
      "netDebtProj": [
        -52000,
        -53000,
        -54000,
        -55000,
        -56000
      ],
      "sharesProj": [
        12300,
        12200,
        12100,
        12000,
        11800
      ],
      "multiples": {
        "per": 23,
        "pfcf": 24,
        "evEbitda": 12,
        "evEbit": 17
      },
      "dividendYield": 0.5,
      "revenue": [
        null,
        null,
        null,
        null,
        null,
        350018,
        359713
      ],
      "da": [
        null,
        null,
        null,
        null,
        null,
        15311,
        16385
      ],
      "ebit": [
        null,
        null,
        null,
        null,
        null,
        114186,
        119320
      ],
      "interest": [
        null,
        null,
        null,
        null,
        null,
        268,
        208
      ],
      "taxes": [
        null,
        null,
        null,
        null,
        null,
        19697,
        22293
      ],
      "minority": [
        null,
        null,
        null,
        null,
        null,
        null,
        null
      ],
      "shares": [
        null,
        null,
        null,
        null,
        null,
        12447,
        12388
      ],
      "capex": [
        null,
        null,
        null,
        null,
        null,
        52535,
        57720
      ],
      "leases": [
        null,
        null,
        null,
        null,
        null,
        null,
        null
      ],
      "cash": [
        null,
        null,
        null,
        null,
        null,
        95657,
        95328
      ],
      "debt": [
        null,
        null,
        null,
        null,
        null,
        28137,
        28498
      ],
      "leaseDebt": [
        null,
        null,
        null,
        null,
        null,
        16235,
        16612
      ],
      "goodwill": [
        null,
        null,
        null,
        null,
        null,
        31885,
        32173
      ],
      "equity": [
        null,
        null,
        null,
        null,
        null,
        325084,
        345267
      ]
    },
    "notes": "Importado de tu Excel 2025-06-23_GOOGL_PDV.xlsx (precio y datos a junio de 2025). Usaste la plantilla de Tecnológicas; las acciones y la deuda neta proyectadas las escribiste a mano. Ese Excel no tenía EPS con crecimiento propio, FCF proyectado ni Graham, así que esos métodos están desmarcados en el Resumen (sus valores salen de vínculos automáticos). Actualiza el precio, el año base y los datos para valorarla hoy.",
    "excluded": [
      "epsG",
      "fcf",
      "graham",
      "grahamRev"
    ]
  }
];
