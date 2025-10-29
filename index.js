const express = require('express');
const axios = require('axios');

const app = express();
const PORT = 5000;

const HISTORY_API = 'https://seven89-3mb7.onrender.com';
const CHECK_INTERVAL = 2000;
const WAIT_AFTER_RESULT = 10000;

let currentPrediction = null;
let predictionHistory = [];
let lastResolvedPhien = null;

let patternLearningData = {
  'cau_bet': { total: 0, correct: 0, confidence_adjustment: 0 },
  'cau_dao_1_1': { total: 0, correct: 0, confidence_adjustment: 0 },
  'cau_1_2': { total: 0, correct: 0, confidence_adjustment: 0 },
  'cau_2_2': { total: 0, correct: 0, confidence_adjustment: 0 },
  'cau_4_4': { total: 0, correct: 0, confidence_adjustment: 0 },
  'nhip_nghieng_5': { total: 0, correct: 0, confidence_adjustment: 0 },
  'nhip_nghieng_7': { total: 0, correct: 0, confidence_adjustment: 0 },
  'cau_3_2_1': { total: 0, correct: 0, confidence_adjustment: 0 },
  'cau_1_2_3': { total: 0, correct: 0, confidence_adjustment: 0 },
  'chu_ky_3': { total: 0, correct: 0, confidence_adjustment: 0 },
  'chu_ky_tai': { total: 0, correct: 0, confidence_adjustment: 0 },
  'chu_ky_xiu': { total: 0, correct: 0, confidence_adjustment: 0 },
  'cong_thuc_xuc_xac': { total: 0, correct: 0, confidence_adjustment: 0 },
  'dao_don_gian': { total: 0, correct: 0, confidence_adjustment: 0 },
  'phan_tich_10_van': { total: 0, correct: 0, confidence_adjustment: 0 },
  'cau_lech_tai_xiu': { total: 0, correct: 0, confidence_adjustment: 0 }
};

function updatePatternLearning(pattern, isCorrect) {
  if (!patternLearningData[pattern]) {
    patternLearningData[pattern] = { total: 0, correct: 0, confidence_adjustment: 0 };
  }
  
  patternLearningData[pattern].total++;
  if (isCorrect) {
    patternLearningData[pattern].correct++;
  }
  
  const accuracy = patternLearningData[pattern].correct / patternLearningData[pattern].total;
  
  if (patternLearningData[pattern].total >= 5) {
    if (accuracy >= 0.75) {
      patternLearningData[pattern].confidence_adjustment = +10;
    } else if (accuracy >= 0.65) {
      patternLearningData[pattern].confidence_adjustment = +5;
    } else if (accuracy >= 0.55) {
      patternLearningData[pattern].confidence_adjustment = 0;
    } else if (accuracy >= 0.45) {
      patternLearningData[pattern].confidence_adjustment = -5;
    } else {
      patternLearningData[pattern].confidence_adjustment = -10;
    }
  }
  
  console.log(`📚 Học: ${pattern} - ${patternLearningData[pattern].correct}/${patternLearningData[pattern].total} (${(accuracy * 100).toFixed(1)}%) | Điều chỉnh: ${patternLearningData[pattern].confidence_adjustment > 0 ? '+' : ''}${patternLearningData[pattern].confidence_adjustment}%`);
}

function applyLearningAdjustment(pattern, baseConfidence) {
  if (patternLearningData[pattern] && patternLearningData[pattern].total >= 5) {
    const adjusted = baseConfidence + patternLearningData[pattern].confidence_adjustment;
    return Math.max(30, Math.min(95, adjusted));
  }
  return baseConfidence;
}

function analyzeCauBet(history) {
  if (history.length < 5) return null;
  
  let consecutiveCount = 1;
  let lastResult = history[0].ket_qua;
  
  for (let i = 1; i < Math.min(history.length, 20); i++) {
    if (history[i].ket_qua === lastResult) {
      consecutiveCount++;
    } else {
      break;
    }
  }
  
  if (consecutiveCount >= 5) {
    const baseConfidence = Math.min(60 + consecutiveCount * 3, 88);
    return {
      pattern: 'cau_bet',
      count: consecutiveCount,
      prediction: consecutiveCount >= 12 ? (lastResult === 'tai' ? 'xiu' : 'tai') : lastResult,
      confidence: applyLearningAdjustment('cau_bet', baseConfidence)
    };
  }
  
  return null;
}

function analyzeCauDao11(history) {
  if (history.length < 4) return null;
  
  const recent = history.slice(0, 8);
  let isDao = true;
  
  for (let i = 0; i < recent.length - 1; i++) {
    if (recent[i].ket_qua === recent[i + 1].ket_qua) {
      isDao = false;
      break;
    }
  }
  
  if (isDao && recent.length >= 4) {
    const nextPrediction = recent[0].ket_qua === 'tai' ? 'xiu' : 'tai';
    return {
      pattern: 'cau_dao_1_1',
      prediction: nextPrediction,
      confidence: applyLearningAdjustment('cau_dao_1_1', 78)
    };
  }
  
  return null;
}

function analyzeCau12(history) {
  if (history.length < 9) return null;
  
  let cycleMatches = 0;
  
  for (let start = 0; start <= history.length - 6; start += 3) {
    if (start + 5 >= history.length) break;
    
    const r0 = history[start].ket_qua;
    const r1 = history[start + 1].ket_qua;
    const r2 = history[start + 2].ket_qua;
    const r3 = history[start + 3].ket_qua;
    const r4 = history[start + 4].ket_qua;
    const r5 = history[start + 5].ket_qua;
    
    if (r0 === r1 && r0 !== r2 && r3 === r4 && r3 !== r5 && r0 === r3 && r2 === r5) {
      cycleMatches++;
    }
  }
  
  if (cycleMatches >= 1) {
    const r0 = history[0].ket_qua;
    const r1 = history[1].ket_qua;
    const r2 = history[2].ket_qua;
    
    if (r0 === r1 && r0 !== r2) {
      return {
        pattern: 'cau_1_2',
        prediction: r2,
        confidence: applyLearningAdjustment('cau_1_2', 72)
      };
    }
  }
  
  return null;
}

function analyzeCau22(history) {
  if (history.length < 8) return null;
  
  let matches = 0;
  
  for (let i = 0; i <= history.length - 8; i += 4) {
    if (i + 7 >= history.length) break;
    
    const p1_a = history[i].ket_qua;
    const p1_b = history[i + 1].ket_qua;
    const p2_a = history[i + 2].ket_qua;
    const p2_b = history[i + 3].ket_qua;
    const p3_a = history[i + 4].ket_qua;
    const p3_b = history[i + 5].ket_qua;
    const p4_a = history[i + 6].ket_qua;
    const p4_b = history[i + 7].ket_qua;
    
    if (p1_a === p1_b && p2_a === p2_b && p3_a === p3_b && p4_a === p4_b &&
        p1_a !== p2_a && p2_a !== p3_a && p3_a !== p4_a) {
      matches++;
    }
  }
  
  if (matches >= 1) {
    const last2 = [history[0].ket_qua, history[1].ket_qua];
    if (last2[0] === last2[1]) {
      return {
        pattern: 'cau_2_2',
        prediction: last2[0] === 'tai' ? 'xiu' : 'tai',
        confidence: applyLearningAdjustment('cau_2_2', 74)
      };
    }
  }
  
  return null;
}

function analyzeCau44(history) {
  if (history.length < 8) return null;
  
  let consecutiveCount = 1;
  let lastResult = history[0].ket_qua;
  
  for (let i = 1; i < Math.min(history.length, 10); i++) {
    if (history[i].ket_qua === lastResult) {
      consecutiveCount++;
    } else {
      break;
    }
  }
  
  if (consecutiveCount === 4 && history.length >= 8) {
    const before4 = history.slice(4, 8);
    if (before4.length === 4) {
      const allSame = before4.every(item => item.ket_qua === before4[0].ket_qua);
      
      if (allSame && before4[0].ket_qua !== lastResult) {
        return {
          pattern: 'cau_4_4',
          prediction: lastResult === 'tai' ? 'xiu' : 'tai',
          confidence: applyLearningAdjustment('cau_4_4', 76)
        };
      }
    }
  }
  
  return null;
}

function analyzeCauNghieng5(history) {
  if (history.length < 5) return null;
  
  const recent5 = history.slice(0, 5);
  let taiCount = 0;
  let xiuCount = 0;
  
  recent5.forEach(item => {
    if (item.ket_qua === 'tai') taiCount++;
    else xiuCount++;
  });
  
  if (taiCount === 4 && xiuCount === 1) {
    return {
      pattern: 'nhip_nghieng_5',
      prediction: 'tai',
      confidence: applyLearningAdjustment('nhip_nghieng_5', 73)
    };
  } else if (xiuCount === 4 && taiCount === 1) {
    return {
      pattern: 'nhip_nghieng_5',
      prediction: 'xiu',
      confidence: applyLearningAdjustment('nhip_nghieng_5', 73)
    };
  }
  
  return null;
}

function analyzeCauNghieng7(history) {
  if (history.length < 7) return null;
  
  const recent7 = history.slice(0, 7);
  let taiCount = 0;
  let xiuCount = 0;
  
  recent7.forEach(item => {
    if (item.ket_qua === 'tai') taiCount++;
    else xiuCount++;
  });
  
  if (taiCount === 5 && xiuCount === 2) {
    return {
      pattern: 'nhip_nghieng_7',
      prediction: 'tai',
      confidence: applyLearningAdjustment('nhip_nghieng_7', 77)
    };
  } else if (xiuCount === 5 && taiCount === 2) {
    return {
      pattern: 'nhip_nghieng_7',
      prediction: 'xiu',
      confidence: applyLearningAdjustment('nhip_nghieng_7', 77)
    };
  }
  
  return null;
}

function analyzeCauPattern321(history) {
  if (history.length < 6) return null;
  
  const r = history.slice(0, 6);
  
  const last1 = r[0].ket_qua;
  const mid2_a = r[1].ket_qua;
  const mid2_b = r[2].ket_qua;
  const first3_a = r[3].ket_qua;
  const first3_b = r[4].ket_qua;
  const first3_c = r[5].ket_qua;
  
  const first3Same = first3_a === first3_b && first3_b === first3_c;
  const mid2Same = mid2_a === mid2_b;
  const mid2DifferentFromFirst3 = mid2_a !== first3_a;
  const last1SameAsFirst3 = last1 === first3_a;
  const last1DifferentFromMid2 = last1 !== mid2_a;
  
  if (first3Same && mid2Same && mid2DifferentFromFirst3 && last1SameAsFirst3 && last1DifferentFromMid2) {
    return {
      pattern: 'cau_3_2_1',
      prediction: mid2_a,
      confidence: applyLearningAdjustment('cau_3_2_1', 70)
    };
  }
  
  return null;
}

function analyzeCauPattern123(history) {
  if (history.length < 6) return null;
  
  const r = history.slice(0, 6);
  
  const last3_a = r[0].ket_qua;
  const last3_b = r[1].ket_qua;
  const last3_c = r[2].ket_qua;
  const mid2_a = r[3].ket_qua;
  const mid2_b = r[4].ket_qua;
  const first1 = r[5].ket_qua;
  
  const last3Same = last3_a === last3_b && last3_b === last3_c;
  const mid2Same = mid2_a === mid2_b;
  const mid2DifferentFromLast3 = mid2_a !== last3_a;
  const first1SameAsLast3 = first1 === last3_a;
  const first1DifferentFromMid2 = first1 !== mid2_a;
  
  if (last3Same && mid2Same && mid2DifferentFromLast3 && first1SameAsLast3 && first1DifferentFromMid2) {
    return {
      pattern: 'cau_1_2_3',
      prediction: mid2_a,
      confidence: applyLearningAdjustment('cau_1_2_3', 69)
    };
  }
  
  return null;
}

function analyzeChuKy(history) {
  if (history.length < 10) return null;
  
  const last20 = history.slice(0, Math.min(20, history.length));
  let taiCount = 0;
  let xiuCount = 0;
  
  last20.forEach(item => {
    if (item.ket_qua === 'tai') taiCount++;
    else xiuCount++;
  });
  
  const recent3 = history.slice(0, 3);
  let recent3Same = recent3[0].ket_qua;
  let allSame = recent3.every(item => item.ket_qua === recent3Same);
  
  if (allSame && recent3.length === 3) {
    return {
      pattern: 'chu_ky_3',
      prediction: recent3Same === 'tai' ? 'xiu' : 'tai',
      confidence: applyLearningAdjustment('chu_ky_3', 71)
    };
  }
  
  if (taiCount >= 13) {
    return {
      pattern: 'chu_ky_tai',
      prediction: 'xiu',
      confidence: applyLearningAdjustment('chu_ky_tai', 68)
    };
  } else if (xiuCount >= 13) {
    return {
      pattern: 'chu_ky_xiu',
      prediction: 'tai',
      confidence: applyLearningAdjustment('chu_ky_xiu', 68)
    };
  }
  
  return null;
}

function analyzeDiceFormula(history) {
  if (history.length < 1) return null;
  
  const latest = history[0];
  const a = parseInt(latest.xuc_xac_1);
  const b = parseInt(latest.xuc_xac_2);
  const c = parseInt(latest.xuc_xac_3);
  
  if (isNaN(a) || isNaN(b) || isNaN(c)) return null;
  
  const formula1 = (a + b - c) / 2;
  const remainder = Math.abs(formula1 % 3);
  
  let prediction1 = null;
  if (remainder <= 1) {
    prediction1 = 'tai';
  } else {
    prediction1 = 'xiu';
  }
  
  const formula2 = (a + b + c) - 6;
  let prediction2 = null;
  if (formula2 > 5) {
    prediction2 = 'tai';
  } else if (formula2 < -1) {
    prediction2 = 'xiu';
  }
  
  if (prediction1 && prediction2 && prediction1 === prediction2) {
    return {
      pattern: 'cong_thuc_xuc_xac',
      prediction: prediction1,
      confidence: applyLearningAdjustment('cong_thuc_xuc_xac', 66)
    };
  }
  
  return null;
}

function analyzePhanTich10Van(history) {
  if (history.length < 10) return null;
  
  const last10 = history.slice(0, 10);
  let taiCount = 0;
  let xiuCount = 0;
  
  last10.forEach(item => {
    if (item.ket_qua === 'tai') taiCount++;
    else xiuCount++;
  });
  
  const lastResult = history[0].ket_qua;
  
  if (taiCount >= 7) {
    return {
      pattern: 'phan_tich_10_van',
      prediction: 'xiu',
      confidence: applyLearningAdjustment('phan_tich_10_van', 65 + (taiCount - 7) * 3)
    };
  } else if (xiuCount >= 7) {
    return {
      pattern: 'phan_tich_10_van',
      prediction: 'tai',
      confidence: applyLearningAdjustment('phan_tich_10_van', 65 + (xiuCount - 7) * 3)
    };
  } else if (taiCount === 3 && xiuCount === 7 || taiCount === 7 && xiuCount === 3) {
    const dominant = taiCount > xiuCount ? 'tai' : 'xiu';
    return {
      pattern: 'phan_tich_10_van',
      prediction: dominant,
      confidence: applyLearningAdjustment('phan_tich_10_van', 62)
    };
  }
  
  return null;
}

function analyzeCauLechTaiXiu(history) {
  if (history.length < 15) return null;
  
  const last15 = history.slice(0, 15);
  let taiCount = 0;
  let xiuCount = 0;
  
  last15.forEach(item => {
    if (item.ket_qua === 'tai') taiCount++;
    else xiuCount++;
  });
  
  const diff = Math.abs(taiCount - xiuCount);
  
  if (diff >= 7) {
    const lessFrequent = taiCount < xiuCount ? 'tai' : 'xiu';
    return {
      pattern: 'cau_lech_tai_xiu',
      prediction: lessFrequent,
      confidence: applyLearningAdjustment('cau_lech_tai_xiu', 64 + Math.min(diff - 7, 4) * 2)
    };
  }
  
  return null;
}

function predictNextSession(history) {
  if (!history || history.length === 0) {
    return {
      prediction: 'tai',
      confidence: 50,
      pattern: 'random'
    };
  }

  const analyses = [
    analyzeCauDao11(history),
    analyzeCauNghieng7(history),
    analyzeCau44(history),
    analyzeCauBet(history),
    analyzeCauNghieng5(history),
    analyzeCau22(history),
    analyzeCauPattern321(history),
    analyzeCau12(history),
    analyzeChuKy(history),
    analyzeCauPattern123(history),
    analyzeDiceFormula(history),
    analyzePhanTich10Van(history),
    analyzeCauLechTaiXiu(history)
  ].filter(a => a !== null);

  if (analyses.length > 0) {
    analyses.sort((a, b) => b.confidence - a.confidence);
    return {
      prediction: analyses[0].prediction,
      confidence: analyses[0].confidence,
      pattern: analyses[0].pattern
    };
  }

  const last10 = history.slice(0, Math.min(10, history.length));
  let taiCount = 0;
  let xiuCount = 0;
  
  last10.forEach(item => {
    if (item.ket_qua === 'tai') taiCount++;
    else xiuCount++;
  });

  const lastResult = history[0].ket_qua;
  const prediction = lastResult === 'tai' ? 'xiu' : 'tai';
  
  let confidence = 50;
  if (prediction === 'tai') {
    const taiRatio = taiCount / last10.length;
    if (taiRatio < 0.3) confidence = 62;
    else if (taiRatio < 0.4) confidence = 58;
    else if (taiRatio > 0.7) confidence = 52;
    else confidence = 55;
  } else {
    const xiuRatio = xiuCount / last10.length;
    if (xiuRatio < 0.3) confidence = 62;
    else if (xiuRatio < 0.4) confidence = 58;
    else if (xiuRatio > 0.7) confidence = 52;
    else confidence = 55;
  }
  
  return {
    prediction: prediction,
    confidence: applyLearningAdjustment('dao_don_gian', confidence),
    pattern: 'dao_don_gian'
  };
}

async function fetchHistory() {
  try {
    const response = await axios.get(HISTORY_API, {
      timeout: 10000
    });
    
    if (Array.isArray(response.data)) {
      return response.data;
    } else if (response.data && typeof response.data === 'object') {
      return [response.data];
    }
    
    return [];
  } catch (error) {
    console.error('Lỗi khi lấy lịch sử:', error.message);
    return [];
  }
}

async function updatePrediction() {
  try {
    const history = await fetchHistory();
    
    if (history.length === 0) {
      console.log('Không có dữ liệu lịch sử');
      return;
    }

    const latestSession = history[0];
    const nextSessionNumber = String(parseInt(latestSession.phien) + 1);

    if (currentPrediction && currentPrediction.phien === latestSession.phien && currentPrediction.kq_du_doan === 'dang_doi') {
      const isCorrect = currentPrediction.du_doan === latestSession.ket_qua;
      
      updatePatternLearning(currentPrediction.thuat_toan, isCorrect);
      
      currentPrediction = {
        ...currentPrediction,
        kq_du_doan: isCorrect ? 'dung' : 'sai',
        ket_qua: latestSession.ket_qua,
        xuc_xac_1: latestSession.xuc_xac_1,
        xuc_xac_2: latestSession.xuc_xac_2,
        xuc_xac_3: latestSession.xuc_xac_3,
        tong: latestSession.tong,
        thoi_gian_cap_nhat: new Date().toISOString()
      };
      
      predictionHistory.unshift({...currentPrediction});
      if (predictionHistory.length > 100) {
        predictionHistory = predictionHistory.slice(0, 100);
      }
      
      console.log(`✅ Phiên ${currentPrediction.phien}: Dự đoán ${currentPrediction.du_doan.toUpperCase()} - Kết quả ${latestSession.ket_qua.toUpperCase()} - ${isCorrect ? '✓ ĐÚNG' : '✗ SAI'}`);
      
      lastResolvedPhien = currentPrediction.phien;
      console.log(`⏰ Đợi 10 giây trước khi dự đoán phiên mới...`);
      
      setTimeout(() => {
        lastResolvedPhien = null;
        console.log(`⏰ Sẵn sàng dự đoán phiên mới!`);
      }, WAIT_AFTER_RESULT);
      
    } else if (lastResolvedPhien && latestSession.phien <= lastResolvedPhien) {
      return;
      
    } else if (!currentPrediction || currentPrediction.kq_du_doan !== 'dang_doi') {
      lastResolvedPhien = null;
      
      const prediction = predictNextSession(history);
      
      currentPrediction = {
        phien: nextSessionNumber,
        du_doan: prediction.prediction,
        ti_le_thang: `${prediction.confidence}%`,
        kq_du_doan: 'dang_doi',
        ket_qua: 'dang_doi',
        xuc_xac_1: 'dang_doi',
        xuc_xac_2: 'dang_doi',
        xuc_xac_3: 'dang_doi',
        tong: 'dang_doi',
        thuat_toan: prediction.pattern,
        thoi_gian_du_doan: new Date().toISOString()
      };
      
      console.log(`🎲 Dự đoán phiên ${nextSessionNumber}: ${prediction.prediction.toUpperCase()} (${prediction.confidence}% - ${prediction.pattern})`);
    }
  } catch (error) {
    console.error('Lỗi khi cập nhật dự đoán:', error.message);
  }
}

app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.get('/api/prediction', (req, res) => {
  if (!currentPrediction) {
    return res.json({
      phien: '0',
      du_doan: 'dang_doi',
      ti_le_thang: '0%',
      kq_du_doan: 'dang_doi',
      ket_qua: 'dang_doi',
      xuc_xac_1: 'dang_doi',
      xuc_xac_2: 'dang_doi',
      xuc_xac_3: 'dang_doi',
      tong: 'dang_doi'
    });
  }
  
  res.json(currentPrediction);
});

app.get('/api/history', async (req, res) => {
  try {
    const history = await fetchHistory();
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Không thể lấy lịch sử' });
  }
});

app.get('/api/prediction-history', (req, res) => {
  res.json(predictionHistory);
});

app.get('/api/stats', async (req, res) => {
  try {
    const history = await fetchHistory();
    
    if (history.length === 0) {
      return res.json({ error: 'Không có lịch sử' });
    }

    const last20 = history.slice(0, 20);
    let taiCount = 0;
    let xiuCount = 0;
    
    last20.forEach(item => {
      if (item.ket_qua === 'tai') taiCount++;
      else xiuCount++;
    });

    let correctPredictions = 0;
    let totalPredictions = predictionHistory.filter(p => p.kq_du_doan !== 'dang_doi').length;
    
    predictionHistory.forEach(p => {
      if (p.kq_du_doan === 'dung') correctPredictions++;
    });

    const patternStats = {};
    predictionHistory.forEach(p => {
      if (p.kq_du_doan !== 'dang_doi') {
        if (!patternStats[p.thuat_toan]) {
          patternStats[p.thuat_toan] = { total: 0, correct: 0 };
        }
        patternStats[p.thuat_toan].total++;
        if (p.kq_du_doan === 'dung') {
          patternStats[p.thuat_toan].correct++;
        }
      }
    });

    res.json({
      last20Sessions: {
        tai: taiCount,
        xiu: xiuCount,
        total: last20.length
      },
      predictionStats: {
        total: totalPredictions,
        correct: correctPredictions,
        wrong: totalPredictions - correctPredictions,
        accuracy: totalPredictions > 0 ? ((correctPredictions / totalPredictions) * 100).toFixed(1) + '%' : '0%'
      },
      patternPerformance: patternStats,
      latestSession: history[0],
      currentPrediction: currentPrediction
    });
  } catch (error) {
    res.status(500).json({ error: 'Không thể lấy thống kê' });
  }
});

app.get('/api/learning', (req, res) => {
  const learningStats = {};
  
  Object.keys(patternLearningData).forEach(pattern => {
    const data = patternLearningData[pattern];
    if (data.total > 0) {
      learningStats[pattern] = {
        total: data.total,
        correct: data.correct,
        accuracy: ((data.correct / data.total) * 100).toFixed(1) + '%',
        confidence_adjustment: data.confidence_adjustment
      };
    }
  });
  
  res.json({
    message: 'Dữ liệu học tập từng thuật toán',
    learning_data: learningStats,
    total_patterns: Object.keys(learningStats).length,
    system_status: 'Đang học và cải thiện'
  });
});

app.get('/api/capital-advice', async (req, res) => {
  try {
    const history = await fetchHistory();
    
    if (history.length === 0) {
      return res.json({ error: 'Không có lịch sử' });
    }
    
    let winStreak = 0;
    let loseStreak = 0;
    
    for (let i = 0; i < Math.min(predictionHistory.length, 10); i++) {
      if (predictionHistory[i].kq_du_doan === 'dung') {
        winStreak++;
        loseStreak = 0;
      } else if (predictionHistory[i].kq_du_doan === 'sai') {
        loseStreak++;
        winStreak = 0;
      }
      if (winStreak >= 3 || loseStreak >= 2) break;
    }
    
    let correctPredictions = 0;
    let totalPredictions = predictionHistory.filter(p => p.kq_du_doan !== 'dang_doi').length;
    predictionHistory.forEach(p => {
      if (p.kq_du_doan === 'dung') correctPredictions++;
    });
    
    const accuracy = totalPredictions > 0 ? (correctPredictions / totalPredictions) * 100 : 0;
    
    let advice = {
      bet_strategy: '',
      risk_level: '',
      suggested_action: '',
      capital_management: ''
    };
    
    if (winStreak >= 3) {
      advice.bet_strategy = 'Tăng 20% mỗi ván (đang trên chuỗi thắng)';
      advice.risk_level = 'Trung bình - Cao';
      advice.suggested_action = 'Tiếp tục đánh nhẹ, dừng khi thua 1 ván';
      advice.capital_management = 'Dùng 30-40% vốn';
    } else if (loseStreak >= 2) {
      advice.bet_strategy = 'Gấp thếp (Martingale) hoặc nghỉ';
      advice.risk_level = 'Cao';
      advice.suggested_action = 'Cân nhắc nghỉ hoặc giảm cược xuống 10-20% vốn';
      advice.capital_management = 'Dùng tối đa 20% vốn, ưu tiên bảo toàn';
    } else if (accuracy >= 70) {
      advice.bet_strategy = 'Đánh đều tay';
      advice.risk_level = 'Thấp - Trung bình';
      advice.suggested_action = 'Độ chính xác tốt, tiếp tục chiến lược hiện tại';
      advice.capital_management = 'Dùng 25-30% vốn';
    } else {
      advice.bet_strategy = 'Quan sát thêm';
      advice.risk_level = 'Thấp';
      advice.suggested_action = 'Chưa đủ dữ liệu hoặc độ chính xác thấp, đánh nhẹ';
      advice.capital_management = 'Dùng tối đa 15-20% vốn';
    }
    
    res.json({
      current_stats: {
        win_streak: winStreak,
        lose_streak: loseStreak,
        accuracy: accuracy.toFixed(1) + '%',
        total_predictions: totalPredictions
      },
      advice: advice,
      warning: 'Lời khuyên chỉ mang tính tham khảo. Luôn quản lý vốn cẩn thận và biết dừng đúng lúc!'
    });
  } catch (error) {
    res.status(500).json({ error: 'Không thể lấy lời khuyên' });
  }
});

app.get('/', (req, res) => {
  res.json({
    message: '🎲 API Dự Đoán Tài Xỉu 789.club - AI Self-Learning Edition',
    version: '3.0 - AI Adaptive Learning',
    new_features: [
      '🧠 Hệ thống tự học thích nghi',
      '📊 Điều chỉnh độ tin cậy tự động dựa trên hiệu suất',
      '💰 Lời khuyên quản lý vốn thông minh',
      '📈 Phân tích 10 ván gần nhất',
      '⚖️ Phát hiện cầu lệch Tài/Xỉu'
    ],
    algorithms: [
      'Cầu Đảo 1-1',
      'Cầu Bệt (5+ ván)',
      'Cầu 1-2',
      'Cầu 2-2',
      'Cầu 4-4',
      'Cầu 3-2-1',
      'Cầu 1-2-3',
      'Nhịp Nghiêng 5',
      'Nhịp Nghiêng 7',
      'Chu Kỳ',
      'Công Thức Xúc Xắc',
      'Phân Tích 10 Ván (NEW)',
      'Cầu Lệch Tài Xỉu (NEW)'
    ],
    endpoints: {
      prediction: '/api/prediction - Dự đoán phiên hiện tại',
      history: '/api/history - Lịch sử từ hệ thống gốc',
      predictionHistory: '/api/prediction-history - Lịch sử dự đoán của bot (100 phiên)',
      stats: '/api/stats - Thống kê chi tiết và độ chính xác theo thuật toán',
      learning: '/api/learning - Dữ liệu học tập của từng thuật toán (NEW)',
      capitalAdvice: '/api/capital-advice - Lời khuyên quản lý vốn dựa trên hiệu suất (NEW)'
    },
    config: {
      check_interval: '2 giây',
      wait_after_result: '10 giây (poll liên tục, không bỏ lỡ session)',
      total_algorithms: 13,
      ai_learning: 'Enabled - Tự động điều chỉnh độ tin cậy sau mỗi 5 dự đoán'
    }
  });
});

async function startServer() {
  await updatePrediction();
  
  setInterval(updatePrediction, CHECK_INTERVAL);
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎲 API Dự Đoán Tài Xỉu v3.0 - AI Adaptive Learning`);
    console.log(`📡 Server: http://0.0.0.0:${PORT}`);
    console.log(`🧠 Thuật toán: 13 loại cầu + Hệ thống tự học`);
    console.log(`📊 Endpoints:`);
    console.log(`   - GET /api/prediction - Dự đoán phiên hiện tại`);
    console.log(`   - GET /api/history - Lịch sử hệ thống gốc`);
    console.log(`   - GET /api/prediction-history - Lịch sử dự đoán (100 phiên)`);
    console.log(`   - GET /api/stats - Thống kê chi tiết`);
    console.log(`   - GET /api/learning - Dữ liệu học tập (NEW)`);
    console.log(`   - GET /api/capital-advice - Lời khuyên quản lý vốn (NEW)`);
    console.log(`🔄 Cấu hình: Poll mỗi 2s | AI Learning Enabled`);
    console.log(`✨ Tính năng mới: Tự động điều chỉnh độ tin cậy sau mỗi 5 dự đoán`);
  });
}

startServer();
