#!/usr/bin/env python3
"""A股指数 ML 模型训练脚本（RandomForest）
读取 stdin 的 JSON 输入，训练模型，输出 JSON 结果到 stdout。
"""

import json
import sys
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix


def compute_confusion_matrix(tn, fp, fn, tp):
    return {"tp": int(tp), "fp": int(fp), "tn": int(tn), "fn": int(fn)}


def main():
    raw = sys.stdin.read()
    if not raw.strip():
        print(json.dumps({"success": False, "error": "空输入"}))
        return

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        print(json.dumps({"success": False, "error": f"JSON 解析失败: {str(e)}"}))
        return

    # 解析数据
    train = data.get("train", {})
    val = data.get("val", {})
    test = data.get("test", {})
    latest_features = data.get("latest_features", {})
    index_defs = data.get("index_defs", [])
    config = data.get("config", {})

    X_train = np.array(train.get("features", []), dtype=np.float64)
    y_train = np.array(train.get("labels", []), dtype=np.int32)
    train_index_codes = train.get("index_codes", [])

    X_val = np.array(val.get("features", []), dtype=np.float64)
    y_val = np.array(val.get("labels", []), dtype=np.int32)
    val_index_codes = val.get("index_codes", [])

    X_test = np.array(test.get("features", []), dtype=np.float64)
    y_test = np.array(test.get("labels", []), dtype=np.int32)
    test_index_codes = test.get("index_codes", [])
    test_dates = test.get("dates", [])

    # 检查数据完整性
    if len(X_train) < 10:
        print(json.dumps({"success": False, "error": f"训练数据不足（{len(X_train)} 条）"}))
        return

    # 训练参数
    n_estimators = config.get("n_estimators", 100)
    max_depth = config.get("max_depth", None)
    min_samples_leaf = config.get("min_samples_leaf", 5)
    random_state = config.get("random_state", 42)

    # 训练 RandomForest
    clf = RandomForestClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        min_samples_leaf=min_samples_leaf,
        random_state=random_state,
        n_jobs=-1,
        class_weight="balanced",
    )
    clf.fit(X_train, y_train)

    # ===== 在测试集上评估 =====
    if len(X_test) > 0:
        y_pred = clf.predict(X_test)
        y_prob = clf.predict_proba(X_test)[:, 1]  # prob_up

        acc = float(accuracy_score(y_test, y_pred))
        prec = float(precision_score(y_test, y_pred, zero_division=0))
        rec = float(recall_score(y_test, y_pred, zero_division=0))
        f1 = float(f1_score(y_test, y_pred, zero_division=0))
        cm = confusion_matrix(y_test, y_pred, labels=[0, 1])

        tn, fp, fn, tp = cm.ravel()
        confusion = compute_confusion_matrix(tn, fp, fn, tp)

        # 预测历史（测试集）
        prediction_history = []
        for i in range(len(X_test)):
            prediction_history.append({
                "date": test_dates[i] if i < len(test_dates) else "",
                "upProb": round(float(y_prob[i]), 4),
                "actual": int(y_test[i]),
                "correct": bool((y_prob[i] >= 0.5 and y_test[i] == 1) or (y_prob[i] < 0.5 and y_test[i] == 0)),
            })

        # 指数分解准确率
        index_breakdown = []
        for idx_def in index_defs:
            code = idx_def["code"]
            name = idx_def["name"]
            # 找到该指数在测试集中的样本
            indices = [i for i, c in enumerate(test_index_codes) if c == code]
            if len(indices) >= 5:
                idx_y_true = y_test[indices]
                idx_y_pred = y_pred[indices]
                idx_acc = float(accuracy_score(idx_y_true, idx_y_pred))
                idx_prec = float(precision_score(idx_y_true, idx_y_pred, zero_division=0))
                idx_rec = float(recall_score(idx_y_true, idx_y_pred, zero_division=0))
                idx_f1 = float(f1_score(idx_y_true, idx_y_pred, zero_division=0))
                index_breakdown.append({
                    "code": code,
                    "name": name,
                    "accuracy": round(idx_acc, 4),
                    "precision": round(idx_prec, 4),
                    "recall": round(idx_rec, 4),
                    "f1": round(idx_f1, 4),
                    "samples": len(indices),
                })

    else:
        # 没有测试集，用验证集评估
        y_pred = clf.predict(X_val)
        y_prob = clf.predict_proba(X_val)[:, 1]
        acc = float(accuracy_score(y_val, y_pred))
        prec = float(precision_score(y_val, y_pred, zero_division=0))
        rec = float(recall_score(y_val, y_pred, zero_division=0))
        f1 = float(f1_score(y_val, y_pred, zero_division=0))
        cm = confusion_matrix(y_val, y_pred, labels=[0, 1])
        tn, fp, fn, tp = cm.ravel()
        confusion = compute_confusion_matrix(tn, fp, fn, tp)
        prediction_history = []
        index_breakdown = []

    # 特征重要性
    feature_importance = [round(float(v), 6) for v in clf.feature_importances_]

    # ===== 当前预测（7指数次日涨跌） =====
    current_predictions = []
    for idx_def in index_defs:
        code = idx_def["code"]
        name = idx_def["name"]
        if code in latest_features and latest_features[code]:
            feat = np.array(latest_features[code], dtype=np.float64).reshape(1, -1)
            up_prob = float(clf.predict_proba(feat)[0, 1])
            deviation = abs(up_prob - 0.5) * 2
            if deviation >= 0.7:
                confidence = "高"
            elif deviation >= 0.4:
                confidence = "中"
            else:
                confidence = "低"
            current_predictions.append({
                "code": code,
                "name": name,
                "upProb": round(up_prob, 4),
                "confidence": confidence,
            })

    # 输出结果
    result = {
        "success": True,
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1": round(f1, 4),
        "confusion_matrix": confusion,
        "feature_importance": feature_importance,
        "index_breakdown": index_breakdown,
        "prediction_history": prediction_history,
        "current_predictions": current_predictions,
        "training_samples": len(X_train),
        "test_samples": len(X_test),
        "n_estimators": n_estimators,
        "max_depth": max_depth or "不限",
        "min_samples_leaf": min_samples_leaf,
    }

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()