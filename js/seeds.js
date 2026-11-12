/*
 * Empresas que vienen cargadas en la app. Se agregan una sola vez por navegador;
 * si las eliminas no vuelven a aparecer.
 * seedVersion + seedUpdates: si el navegador ya tenía una versión anterior de la empresa, se aplican
 * solo las actualizaciones posteriores (paths: se reemplazan; pathsIfEmpty: solo si el usuario no las llenó;
 * pathsIfEquals: solo si siguen con el valor anterior).
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
      "buyback": -2,
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
      "multiple": 5.5,
      "baseDataYear": 2024
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
      "multiple": null,
      "baseDataYear": null
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
    ],
    "seedVersion": 2,
    "seedUpdates": [
      {
        "version": 2,
        "pathsIfEmpty": [
          "ps.baseDataYear"
        ]
      }
    ],
    "signConvention": 2
  },
  {
    "id": "seed-nvda",
    "ticker": "NVDA",
    "name": "NVIDIA Corp.",
    "notes": "Datos de TIKR (Libro1.xlsx: Income Statement, Balance Sheet y Cash Flow). Precio $173,73 y 24.147 M de acciones al cierre del 11-nov-2026. Años: 2024 = año fiscal FY2025 (cerró ene-2025), 2025 = FY2026 (cerró ene-2026), 2026 = LTM (últimos 12 meses). Capex = Capital Expenditure + Purchase of Intangible Assets, como indica el curso. Ojo: FY2026 y el LTM incluyen una compra de intangibles de 13.000 M que parece puntual; sin ella el capex LTM sería 7.354 M. La proyección hace crecer el capex desde 20.354 M. Intereses = gasto − ingresos financieros (neto es ingreso). Los impuestos incluyen los de la ganancia extraordinaria por inversiones (30.552 M LTM), que no entra al EBIT; por eso la proyección usa la tasa efectiva de TIKR (16 %). SUPUESTOS DE PRUEBA, cámbialos: crecimiento 25 % anual (el consenso a 2 años de TIKR es 79 %, demasiado para 5 años), margen EBIT = el LTM, cambio de acciones −0,8 % anual (recompras: la caída de acciones de los últimos 2 años) y múltiplos = los actuales hasta que pongas los históricos en el Filtro.",
    "excluded": [],
    "price": 173.73,
    "shares": 24147,
    "sector": "tech",
    "baseYear": 2026,
    "ratios": {},
    "egm": {
      "epsGrowth": null,
      "safety": 0,
      "mode": "linear",
      "years": 10,
      "hurdle": 15
    },
    "eps": {
      "analyst": [
        null,
        null,
        null,
        null,
        null
      ],
      "per": null,
      "baseEps": null,
      "cagr": null
    },
    "ps": {
      "revenue": null,
      "growth": [
        null,
        null,
        null,
        null,
        null
      ],
      "multiple": null,
      "baseDataYear": null
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
      "multiple": null,
      "baseDataYear": null
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
        "growth": 25,
        "ebitMargin": null,
        "taxRate": 16,
        "buyback": -0.8
      },
      "netDebtProj": [
        null,
        null,
        null,
        null,
        null
      ],
      "sharesProj": [
        null,
        null,
        null,
        null,
        null
      ],
      "multiples": {
        "per": null,
        "pfcf": null,
        "evEbitda": null,
        "evEbit": null
      },
      "dividendYield": null,
      "revenue": [
        null,
        null,
        null,
        null,
        130497,
        215938,
        302970
      ],
      "da": [
        null,
        null,
        null,
        null,
        1864,
        2843,
        3687
      ],
      "ebit": [
        null,
        null,
        null,
        null,
        81453,
        130387,
        197579
      ],
      "interest": [
        null,
        null,
        null,
        null,
        -1539,
        -2041,
        -1765
      ],
      "taxes": [
        null,
        null,
        null,
        null,
        11146,
        21383,
        36863
      ],
      "minority": [
        null,
        null,
        null,
        null,
        0,
        0,
        0
      ],
      "shares": [
        null,
        null,
        null,
        null,
        24804,
        24514,
        24397.5
      ],
      "capex": [
        null,
        null,
        null,
        null,
        3236,
        19042,
        20354
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
        43210,
        62556,
        62469
      ],
      "debt": [
        null,
        null,
        null,
        null,
        8463,
        8468,
        33366
      ],
      "leaseDebt": [
        null,
        null,
        null,
        null,
        1519,
        2944,
        5494
      ],
      "goodwill": [
        null,
        null,
        null,
        null,
        5188,
        20832,
        21125
      ],
      "equity": [
        null,
        null,
        null,
        null,
        79327,
        157293,
        228984
      ]
    },
    "seedVersion": 5,
    "seedUpdates": [
      {
        "paths": [
          "course.capex",
          "course.da",
          "course.leases"
        ],
        "removeExcluded": [
          "cPfcf"
        ],
        "notesPrefix": "Datos de TIKR (Libro1.xlsx). Precio",
        "version": 2
      },
      {
        "version": 4,
        "pathsIfEquals": {
          "fcf.base": 127006
        }
      },
      {
        "version": 5,
        "notesPrefix": "Datos de TIKR (Libro1.xlsx: Income Statement"
      }
    ],
    "signConvention": 2
  }
];
