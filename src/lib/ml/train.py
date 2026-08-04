#!/usr/bin/env python3
"""A股指数 ML 模型训练脚本（RandomForest）
读取原始 K 线数据，计算 40 维特征，训练模型，输出 JSON 结果到 stdout。
"""

import json
import sys
import math
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
from collections import OrderedDict


# ==================== 指标计算 ====================

def calc_ema(values, period):
    """EMA 计算"""
    result = [0.0] * len(values)
    if len(values) == 0:
        return result
    k = 2.0 / (period + 1)
    result[0] = values[0]
    for i in range(1, len(values)):
        result[i] = values[i] * k + result[i - 1] * (1 - k)
    return result


def calc_ma(values, period):
    """MA 计算"""
    result = [0.0] * len(values)
    for i in range(len(values)):
        if i < period - 1:
            result[i] = 0.0
        else:
            result[i] = sum(values[i - period + 1:i + 1]) / period
    return result


def calc_macd(klines):
    """MACD 计算"""
    closes = [k['close'] for k in klines]
    ema12 = calc_ema(closes, 12)
    ema26 = calc_ema(closes, 26)
    dif = [ema12[i] - ema26[i] for i in range(len(closes))]
    dea = calc_ema(dif, 9)
    histogram = [2.0 * (dif[i] - dea[i]) for i in range(len(closes))]
    return [{'dif': dif[i], 'dea': dea[i], 'histogram': histogram[i]} for i in range(len(closes))]


def calc_rsi(klines, period=14):
    """RSI 计算"""
    closes = [k['close'] for k in klines]
    result = [{'rsi': 50.0}] * len(closes)
    if len(closes) < period + 1:
        return result
    gains = []
    losses = []
    for i in range(1, len(closes)):
        diff = closes[i] - closes[i - 1]
        gains.append(diff if diff > 0 else 0.0)
        losses.append(-diff if diff < 0 else 0.0)
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    for i in range(period, len(closes)):
        if avg_loss < 1e-10:
            result[i] = {'rsi': 100.0}
        else:
            rs = avg_gain / avg_loss
            result[i] = {'rsi': 100.0 - 100.0 / (1.0 + rs)}
        if i < len(closes) - 1:
            avg_gain = (avg_gain * (period - 1) + gains[i]) / period
            avg_loss = (avg_loss * (period - 1) + losses[i]) / period
    return result


def calc_kdj(klines, period=9, k_period=3, d_period=3):
    """KDJ 计算"""
    result = [{'k': 50.0, 'd': 50.0, 'j': 50.0, 'isWarmup': True}] * len(klines)
    for i in range(period - 1, len(klines)):
        hh = max(k['high'] for k in klines[i - period + 1:i + 1])
        ll = min(k['low'] for k in klines[i - period + 1:i + 1])
        close = klines[i]['close']
        if hh - ll < 1e-10:
            rsv = 50.0
        else:
            rsv = (close - ll) / (hh - ll) * 100.0
        if i == period - 1:
            k_val = rsv
            d_val = rsv
        else:
            k_val = 2.0 / 3.0 * result[i - 1]['k'] + 1.0 / 3.0 * rsv
            d_val = 2.0 / 3.0 * result[i - 1]['d'] + 1.0 / 3.0 * k_val
        j_val = 3.0 * k_val - 2.0 * d_val
        result[i] = {'k': k_val, 'd': d_val, 'j': j_val, 'isWarmup': False}
    return result


def calc_boll(klines, period=20, multiplier=2.0):
    """BOLL 计算"""
    closes = [k['close'] for k in klines]
    result = [{'upper': 0.0, 'middle': 0.0, 'lower': 0.0}] * len(klines)
    for i in range(period - 1, len(klines)):
        s = closes[i - period + 1:i + 1]
        ma = sum(s) / period
        variance = sum((x - ma) ** 2 for x in s) / period
        std = math.sqrt(variance)
        result[i] = {
            'upper': ma + multiplier * std,
            'middle': ma,
            'lower': ma - multiplier * std,
        }
    return result


def calc_wr(klines, period=14):
    """Williams %R 计算"""
    result = [0.0] * len(klines)
    for i in range(period - 1, len(klines)):
        hh = max(k['high'] for k in klines[i - period + 1:i + 1])
        ll = min(k['low'] for k in klines[i - period + 1:i + 1])
        close = klines[i]['close']
        if hh - ll < 1e-10:
            result[i] = -50.0
        else:
            result[i] = (hh - close) / (hh - ll) * -100.0
    return result


def calc_atr(klines, period=14):
    """ATR 计算"""
    result = [0.0] * len(klines)
    if len(klines) < 2:
        return result
    tr_values = []
    for i in range(1, len(klines)):
        h = klines[i]['high']
        l = klines[i]['low']
        pc = klines[i - 1]['close']
        tr = max(h - l, abs(h - pc), abs(l - pc))
        tr_values.append(tr)
    for i in range(period, len(tr_values)):
        result[i + 1] = sum(tr_values[i - period + 1:i + 1]) / period
    return result


# ==================== 特征提取 ====================

def compute_quantile_thresholds(klines, up_percentile=60, down_percentile=40):
    """计算分位数阈值"""
    changes = []
    for i in range(1, len(klines)):
        change = (klines[i]['close'] - klines[i - 1]['close']) / klines[i - 1]['close']
        changes.append(change)
    changes.sort()
    up_idx = int(len(changes) * (up_percentile / 100.0))
    down_idx = int(len(changes) * (down_percentile / 100.0))
    return {
        'upThreshold': changes[min(up_idx, len(changes) - 1)],
        'downThreshold': changes[max(0, min(down_idx, len(changes) - 1))],
    }


def extract_features(kline, prev_klines, indicators, index_group, idx):
    """提取 40 维特征向量"""
    feat = []
    o, h, l, c, v = kline['open'], kline['high'], kline['low'], kline['close'], kline['volume']
    prev_c = prev_klines[-1]['close'] if len(prev_klines) > 0 else c

    # 1. change_pct - 涨跌幅
    change_pct = (c - prev_c) / prev_c if prev_c != 0 else 0.0
    feat.append(change_pct * 100.0)

    # 2. amplitude - 振幅
    amplitude = (h - l) / prev_c if prev_c != 0 else 0.0
    feat.append(amplitude * 100.0)

    # 3. body_ratio - 实体比例
    hl_range = h - l
    body_ratio = abs(c - o) / hl_range if hl_range > 1e-10 else 0.0
    feat.append(body_ratio)

    # 4. upper_shadow - 上影线比例
    upper_shadow = (h - max(o, c)) / hl_range if hl_range > 1e-10 else 0.0
    feat.append(upper_shadow)

    # 5. lower_shadow - 下影线比例
    lower_shadow = (min(o, c) - l) / hl_range if hl_range > 1e-10 else 0.0
    feat.append(lower_shadow)

    # 6. volume_ratio - 量比
    avg_vol_5 = sum(prev_klines[-5:]['volume'] for _ in [0]) / 5.0 if len(prev_klines) >= 5 else v
    # Actually let me compute this properly
    avg_vol_5 = v
    if len(prev_klines) >= 5:
        avg_vol_5 = sum(k['volume'] for k in prev_klines[-5:]) / 5.0
    avg_vol_5 = avg_vol_5 if avg_vol_5 > 0 else v
    volume_ratio = v / avg_vol_5 if avg_vol_5 > 0 else 1.0
    feat.append(volume_ratio)

    # 7. avg_volume_5
    avg_vol_5_val = avg_vol_5 / 1e6
    feat.append(avg_vol_5_val)

    # 8. avg_volume_10
    avg_vol_10 = v
    if len(prev_klines) >= 10:
        avg_vol_10 = sum(k['volume'] for k in prev_klines[-10:]) / 10.0
    feat.append(avg_vol_10 / 1e6)

    # 辅助: 获取指标值
    ma = indicators['ma']
    macd_arr = indicators['macd']
    rsi_arr = indicators['rsi']
    kdj_arr = indicators['kdj']
    boll_arr = indicators['boll']
    wr_arr = indicators['wr']
    atr_arr = indicators['atr']

    ma5 = ma.get(5, [c])[idx] if idx < len(ma.get(5, [c])) else c
    ma10 = ma.get(10, [c])[idx] if idx < len(ma.get(10, [c])) else c
    ma20 = ma.get(20, [c])[idx] if idx < len(ma.get(20, [c])) else c
    ma60 = ma.get(60, [c])[idx] if idx < len(ma.get(60, [c])) else c
    ma120 = ma.get(120, [c])[idx] if idx < len(ma.get(120, [c])) else c
    ma250 = ma.get(250, [c])[idx] if idx < len(ma.get(250, [c])) else c

    # 9-14. 均线偏离
    feat.append((c - ma5) / ma5 if ma5 != 0 else 0.0)  # ma5_dev
    feat.append((c - ma10) / ma10 if ma10 != 0 else 0.0)  # ma10_dev
    feat.append((c - ma20) / ma20 if ma20 != 0 else 0.0)  # ma20_dev
    feat.append((c - ma60) / ma60 if ma60 != 0 else 0.0)  # ma60_dev
    feat.append((c - ma120) / ma120 if ma120 != 0 else 0.0)  # ma120_dev
    feat.append((c - ma250) / ma250 if ma250 != 0 else 0.0)  # ma250_dev

    # 15-17. MACD
    macd_val = macd_arr[idx] if idx < len(macd_arr) else {'dif': 0, 'dea': 0, 'histogram': 0}
    feat.append(macd_val['histogram'])  # macd_histogram
    feat.append(macd_val['dif'])  # macd_dif
    feat.append(macd_val['dea'])  # macd_dea

    # 18. RSI
    rsi_val = rsi_arr[idx]['rsi'] if idx < len(rsi_arr) else 50.0
    feat.append(rsi_val / 100.0)

    # 19-21. KDJ
    kdj_val = kdj_arr[idx] if idx < len(kdj_arr) else {'k': 50, 'd': 50, 'j': 50}
    feat.append(kdj_val['k'] / 100.0)
    feat.append(kdj_val['d'] / 100.0)
    feat.append(kdj_val['j'] / 100.0)

    # 22. BOLL位置
    boll_val = boll_arr[idx] if idx < len(boll_arr) else {'upper': c, 'middle': c, 'lower': c}
    boll_range = boll_val['upper'] - boll_val['lower']
    boll_pos = (c - boll_val['middle']) / boll_range if boll_range > 1e-10 else 0.0
    feat.append(boll_pos)

    # 23. BOLL宽度
    boll_width = boll_range / boll_val['middle'] if boll_val['middle'] != 0 else 0.0
    feat.append(boll_width)

    # 24. WR
    wr_val = wr_arr[idx] if idx < len(wr_arr) else 0.0
    feat.append(wr_val / 100.0)

    # 25. consecutive_days - 连涨/连跌天数
    consecutive_days = 0
    for j in range(len(prev_klines) - 1, -1, -1):
        pk = prev_klines[j]
        if (c > prev_c and pk['close'] > pk['open']) or (c < prev_c and pk['close'] < pk['open']):
            consecutive_days += 1
        else:
            break
    feat.append(consecutive_days)

    # 26-27. 月份编码
    try:
        from datetime import datetime
        dt = datetime.strptime(kline['date'], '%Y-%m-%d')
        month = dt.month
    except:
        month = 1
    feat.append(math.sin(2 * math.pi * month / 12.0))
    feat.append(math.cos(2 * math.pi * month / 12.0))

    # 28. 季度末标志
    quarter_end = 1.0 if month in [3, 6, 9, 12] else 0.0
    feat.append(quarter_end)

    # 29. RSI × BOLL位置
    rsi_scaled = rsi_val / 100.0
    feat.append(rsi_scaled * boll_pos)

    # 30. MACD × 成交量
    feat.append(macd_val['histogram'] * volume_ratio)

    # 31. 涨跌幅 × 连涨天数
    feat.append(change_pct * 100.0 * consecutive_days)

    # 32. 实体比例 × 量比
    feat.append(body_ratio * volume_ratio)

    # 33. 振幅 / ATR
    atr_val = atr_arr[idx] if idx < len(atr_arr) else amplitude * prev_c
    atr_ratio = amplitude / (atr_val / prev_c + 1e-10) if prev_c != 0 else 0.0
    feat.append(atr_ratio)

    # 34. RSI × WR
    feat.append(rsi_scaled * (wr_val / 100.0))

    # 35-41. 指数 one-hot 编码 (7个)
    for g in range(7):
        feat.append(1.0 if g == index_group else 0.0)

    return feat


def prepare_samples(klines, index_group, index_code, thresholds=None):
    """准备训练样本"""
    if len(klines) < 61:
        return [], None

    # 计算指标
    indicators = {
        'ma': {p: calc_ma([k['close'] for k in klines], p) for p in [5, 10, 20, 60, 120, 250]},
        'macd': calc_macd(klines),
        'rsi': calc_rsi(klines),
        'kdj': calc_kdj(klines),
        'boll': calc_boll(klines),
        'wr': calc_wr(klines),
        'atr': calc_atr(klines),
    }

    # 计算分位数阈值
    if thresholds is None:
        thresholds = compute_quantile_thresholds(klines)

    samples = []
    for i in range(60, len(klines) - 1):
        change_pct = (klines[i + 1]['close'] - klines[i]['close']) / klines[i]['close']

        label = None
        if change_pct >= thresholds['upThreshold']:
            label = 1
        elif change_pct <= thresholds['downThreshold']:
            label = 0
        else:
            continue

        features = extract_features(klines[i], klines[:i], indicators, index_group, i)
        samples.append({
            'features': features,
            'label': label,
            'index_code': index_code,
            'date': klines[i].get('date', ''),
        })

    # 最新样本特征
    latest_features = None
    if len(klines) > 1:
        last_idx = len(klines) - 1
        latest_features = extract_features(klines[last_idx], klines[:last_idx], indicators, index_group, last_idx)

    return samples, latest_features


def time_series_split(samples, train_ratio=0.7, val_ratio=0.15):
    """时间序列分割"""
    samples.sort(key=lambda s: s['date'])
    total = len(samples)
    train_end = int(total * train_ratio)
    val_end = train_end + int(total * val_ratio)
    return samples[:train_end], samples[train_end:val_end], samples[val_end:]


# ==================== 主流程 ====================

def main():
    if len(sys.argv) > 1:
        filepath = sys.argv[1]
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                raw = f.read()
        except Exception as e:
            print(json.dumps({"success": False, "error": f"读取文件失败: {str(e)}"}))
            return
    else:
        raw = sys.stdin.read()

    if not raw.strip():
        print(json.dumps({"success": False, "error": "空输入"}))
        return

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        print(json.dumps({"success": False, "error": f"JSON 解析失败: {str(e)}"}))
        return

    # 解析输入
    index_defs = data.get("index_defs", [])
    kline_data = data.get("kline_data", {})
    config = data.get("config", {})

    n_estimators = config.get("n_estimators", 100)
    max_depth = config.get("max_depth", None)
    min_samples_leaf = config.get("min_samples_leaf", 5)

    # 为每个指数准备样本
    all_samples = []
    latest_features_map = {}

    for idx_def in index_defs:
        code = idx_def['code']
        group = idx_def['group']
        if code not in kline_data:
            continue
        klines = kline_data[code]
        if len(klines) < 61:
            continue

        samples, latest = prepare_samples(klines, group, code)
        all_samples.extend(samples)
        if latest is not None:
            latest_features_map[code] = latest

    if len(all_samples) < 100:
        print(json.dumps({"success": False, "error": f"样本数不足: {len(all_samples)} 条"}))
        return

    # 时间序列分割
    train_samples, val_samples, test_samples = time_series_split(all_samples)

    # 格式化为 numpy 数组
    train = train_samples
    val = val_samples
    test = test_samples

    X_train = np.array([s['features'] for s in train], dtype=np.float64)
    y_train = np.array([s['label'] for s in train], dtype=np.int32)
    train_index_codes = [s['index_code'] for s in train]

    X_val = np.array([s['features'] for s in val], dtype=np.float64)
    y_val = np.array([s['label'] for s in val], dtype=np.int32)
    val_index_codes = [s['index_code'] for s in val]

    X_test = np.array([s['features'] for s in test], dtype=np.float64)
    y_test = np.array([s['label'] for s in test], dtype=np.int32)
    test_index_codes = [s['index_code'] for s in test]
    test_dates = [s['date'] for s in test]

    # 训练 RandomForest
    clf = RandomForestClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        min_samples_leaf=min_samples_leaf,
        random_state=42,
        n_jobs=-1,
        class_weight="balanced",
    )
    clf.fit(X_train, y_train)

    # 评估
    if len(X_test) > 0:
        y_pred = clf.predict(X_test)
        y_prob = clf.predict_proba(X_test)[:, 1]

        acc = float(accuracy_score(y_test, y_pred))
        prec = float(precision_score(y_test, y_pred, zero_division=0))
        rec = float(recall_score(y_test, y_pred, zero_division=0))
        f1 = float(f1_score(y_test, y_pred, zero_division=0))
        cm = confusion_matrix(y_test, y_pred, labels=[0, 1])
        tn, fp, fn, tp = cm.ravel()

        # 预测历史
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
            code = idx_def['code']
            name = idx_def['name']
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
        y_pred = clf.predict(X_val)
        y_prob = clf.predict_proba(X_val)[:, 1]
        acc = float(accuracy_score(y_val, y_pred))
        prec = float(precision_score(y_val, y_pred, zero_division=0))
        rec = float(recall_score(y_val, y_pred, zero_division=0))
        f1 = float(f1_score(y_val, y_pred, zero_division=0))
        cm = confusion_matrix(y_val, y_pred, labels=[0, 1])
        tn, fp, fn, tp = cm.ravel()
        prediction_history = []
        index_breakdown = []

    # 特征重要性
    feature_importance = [round(float(v), 6) for v in clf.feature_importances_]

    # 当前预测
    current_predictions = []
    for idx_def in index_defs:
        code = idx_def['code']
        name = idx_def['name']
        if code in latest_features_map and latest_features_map[code]:
            feat = np.array(latest_features_map[code], dtype=np.float64).reshape(1, -1)
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
        "confusion_matrix": {"tp": int(tp), "fp": int(fp), "tn": int(tn), "fn": int(fn)},
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