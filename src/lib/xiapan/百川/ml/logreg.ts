// 百川/ml/logreg.ts · 逻辑回归 (纯 JS · 不依赖 Python)
// V0.72 W3 Day 9
//
// 简单 · 解释性强 · 数据少时表现接近 LightGBM
// 当数据 ≥ 500/board 时 · 升级 LightGBM (留以后)
//
// 训练 · L2-regularized logistic regression
//        SGD with mini-batch · 200 epochs · early stop on val loss

export interface LogRegModel {
  weights: number[];                  // 跟特征 1:1
  bias: number;
  n_train: number;
  feature_means: number[];            // 标准化用
  feature_stds: number[];
  metrics: {
    train_brier: number;
    val_brier: number;
    train_auc: number;
    val_auc: number;
    n_train: number;
    n_val: number;
    win_rate_train: number;
    win_rate_val: number;
  };
  trained_at: string;
  feature_keys: string[];
}

export function sigmoid(x: number): number {
  if (x > 50) return 1 - 1e-9;
  if (x < -50) return 1e-9;
  return 1 / (1 + Math.exp(-x));
}

export function logistic_predict_raw(model: LogRegModel, x_raw: number[]): number {
  // 标准化
  const x = x_raw.map((v, i) => {
    const std = model.feature_stds[i] || 1;
    return (v - model.feature_means[i]) / std;
  });
  let z = model.bias;
  for (let i = 0; i < x.length; i++) z += x[i] * (model.weights[i] ?? 0);
  return sigmoid(z);
}

interface TrainOpts {
  X: number[][];                      // [n_samples, n_features]
  y: number[];                        // 0/1
  feature_keys: string[];
  l2: number;                         // L2 正则
  lr: number;                         // 学习率
  epochs: number;
  batch_size: number;
  val_frac: number;                   // 0.2 = 20% val
  seed?: number;
}

function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / Math.max(1, arr.length);
}

function std(arr: number[], m?: number): number {
  const mu = m ?? mean(arr);
  const v = arr.reduce((s, x) => s + (x - mu) ** 2, 0) / Math.max(1, arr.length - 1);
  return Math.sqrt(v) || 1;
}

function brier(yTrue: number[], yPred: number[]): number {
  let s = 0;
  for (let i = 0; i < yTrue.length; i++) s += (yPred[i] - yTrue[i]) ** 2;
  return s / Math.max(1, yTrue.length);
}

function auc(yTrue: number[], yPred: number[]): number {
  // ROC AUC · Mann-Whitney U
  const pairs = yTrue.map((y, i) => ({ y, p: yPred[i] }));
  const pos = pairs.filter((p) => p.y === 1).map((p) => p.p);
  const neg = pairs.filter((p) => p.y === 0).map((p) => p.p);
  if (pos.length === 0 || neg.length === 0) return 0.5;
  let win = 0;
  for (const p of pos) for (const n of neg) {
    if (p > n) win++;
    else if (p === n) win += 0.5;
  }
  return win / (pos.length * neg.length);
}

export function trainLogReg(opts: TrainOpts): LogRegModel {
  const { X, y, feature_keys, l2, lr, epochs, batch_size, val_frac } = opts;
  const n = X.length;
  const d = X[0]?.length ?? 0;
  if (n < 30 || d === 0) {
    throw new Error(`insufficient data n=${n} d=${d}`);
  }

  // 时间感知划分 · 后 val_frac 做 val (不 shuffle)
  const splitIdx = Math.floor(n * (1 - val_frac));
  const Xtr = X.slice(0, splitIdx), ytr = y.slice(0, splitIdx);
  const Xva = X.slice(splitIdx), yva = y.slice(splitIdx);

  // 标准化 · 用 train 统计量
  const means: number[] = [];
  const stds: number[] = [];
  for (let j = 0; j < d; j++) {
    const col = Xtr.map((r) => r[j]);
    const m = mean(col);
    const s = std(col, m);
    means.push(m);
    stds.push(s);
  }
  const norm = (X_ar: number[][]) => X_ar.map((r) => r.map((v, j) => (v - means[j]) / (stds[j] || 1)));
  const Xtr_n = norm(Xtr);
  const Xva_n = norm(Xva);

  // 初始化
  let weights = new Array(d).fill(0);
  let bias = 0;
  let bestModel: LogRegModel | null = null;
  let bestValBrier = Infinity;
  let patience = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    // 简单 · 全 batch · 数据小不用 mini-batch
    const grad_w = new Array(d).fill(0);
    let grad_b = 0;
    for (let i = 0; i < Xtr_n.length; i++) {
      let z = bias;
      for (let j = 0; j < d; j++) z += Xtr_n[i][j] * weights[j];
      const p = sigmoid(z);
      const err = p - ytr[i];
      for (let j = 0; j < d; j++) grad_w[j] += err * Xtr_n[i][j];
      grad_b += err;
    }
    // L2
    for (let j = 0; j < d; j++) {
      weights[j] -= lr * (grad_w[j] / Xtr_n.length + l2 * weights[j]);
    }
    bias -= lr * (grad_b / Xtr_n.length);

    // 验证
    if (epoch % 20 === 0 || epoch === epochs - 1) {
      const yvaPred = Xva_n.map((r) => {
        let z = bias;
        for (let j = 0; j < d; j++) z += r[j] * weights[j];
        return sigmoid(z);
      });
      const valBrier = brier(yva, yvaPred);

      if (valBrier < bestValBrier) {
        bestValBrier = valBrier;
        const ytrPred = Xtr_n.map((r) => {
          let z = bias;
          for (let j = 0; j < d; j++) z += r[j] * weights[j];
          return sigmoid(z);
        });
        bestModel = {
          weights: [...weights],
          bias,
          n_train: Xtr.length,
          feature_means: means,
          feature_stds: stds,
          metrics: {
            train_brier: brier(ytr, ytrPred),
            val_brier: valBrier,
            train_auc: auc(ytr, ytrPred),
            val_auc: auc(yva, yvaPred),
            n_train: Xtr.length,
            n_val: Xva.length,
            win_rate_train: mean(ytr),
            win_rate_val: mean(yva),
          },
          trained_at: new Date().toISOString(),
          feature_keys: [...feature_keys],
        };
        patience = 0;
      } else {
        patience++;
        if (patience >= 5) break;        // early stop
      }
    }
  }

  if (!bestModel) throw new Error("training failed · no best model");
  return bestModel;
}
