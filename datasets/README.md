# Datasets

Deze map bevat de trainings- en testdata voor de **NN Layer Test** (taak C: cijfers en
taak D: letters). De bestanden staan **niet in git** — ze zijn samen ongeveer 46 MB en
gewoon opnieuw te downloaden.

Verwachte structuur:

```
datasets/
├── cijfers-mnist/
│   ├── train-images-idx3-ubyte.gz
│   ├── train-labels-idx1-ubyte.gz
│   ├── t10k-images-idx3-ubyte.gz
│   └── t10k-labels-idx1-ubyte.gz
└── letters-emnist/
    ├── emnist-letters-train-images-idx3-ubyte.gz
    ├── emnist-letters-train-labels-idx1-ubyte.gz
    ├── emnist-letters-test-images-idx3-ubyte.gz
    └── emnist-letters-test-labels-idx1-ubyte.gz
```

- **MNIST** (handgeschreven cijfers) — <https://yann.lecun.com/exdb/mnist/> of een van
  de vele mirrors; de bestanden houden hun oorspronkelijke naam.
- **EMNIST Letters** (handgeschreven letters) — <https://www.nist.gov/itl/products-and-services/emnist-dataset>,
  de split `emnist-letters` uit de gzip-variant.

Zonder deze map werkt de test ook: `nn-layer-test.html` haalt de dataset dan via
internet op. Met de map erbij kies je in de test "kies datasetmap" en draait alles
volledig lokaal.
