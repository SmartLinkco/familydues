/**
 * Payment allocation engine — monthly dues, acceptance fees, advance & arrears
 * Deploy alongside Code.gs in the same Apps Script project
 */

// ─── Eligibility & helpers ───────────────────────────────────────────────────

function isMonthlyDuesEligible(member) {
  if (!member || member.Status !== 'Active') return false;
  if (member.ExemptionReason && member.ExemptionReason !== 'none') return false;
  return true;
}

function canPayAcceptanceFee(member) {
  return member && member.Status !== 'Inactive';
}

function getMemberAcceptanceFee(member) {
  var fee = parseFloat(member.AcceptanceFeeAmount);
  if (!isNaN(fee) && fee >= 0) return fee;
  return getDefaultAcceptanceFee();
}

function isAcceptanceFeeComplete(member) {
  return String(member.AcceptanceFeeWaived).toUpperCase() === 'TRUE' ||
    String(member.AcceptanceFeePaid).toUpperCase() === 'TRUE';
}

function getAllPaymentRecords() {
  return sheetToObjects(getSheet('PAYMENTS')).map(normalizePaymentRecord);
}

function getPaymentType(p) {
  return p.PaymentType || 'MonthlyDues';
}

function getTotalPaidForMonth(memberId, month) {
  var total = 0;
  getAllPaymentRecords().forEach(function (p) {
    if (String(p.MemberID) !== String(memberId)) return;
    if (getPaymentType(p) !== 'MonthlyDues') return;
    if (monthsMatch(p.Month, month)) total += parseFloat(p.AmountPaid) || 0;
  });
  return total;
}

function getMemberMonthStatus(member, month) {
  if (!isMonthlyDuesEligible(member)) return 'Exempt';
  var dues = parseFloat(member.DuesAmount) || 0;
  var paid = getTotalPaidForMonth(member.MemberID, month);
  if (paid >= dues - 0.009) return 'Paid';
  if (paid > 0) return 'Partial';
  return 'Unpaid';
}

function getMonthOutstanding(member, month) {
  if (!isMonthlyDuesEligible(member)) return 0;
  var dues = parseFloat(member.DuesAmount) || 0;
  return Math.max(0, dues - getTotalPaidForMonth(member.MemberID, month));
}

function addMonthsDate(date, count) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function compareMonths(a, b) {
  var da = parseMonthLabel(normalizeMonthLabel(a));
  var db = parseMonthLabel(normalizeMonthLabel(b));
  if (!da || !db) return 0;
  return da.getTime() - db.getTime();
}

function generateBatchPaymentId(sheet) {
  return generatePaymentId(sheet);
}

function generateLinePaymentId(batchId, index) {
  return batchId + '-' + ('0' + index).slice(-2);
}

// ─── Allocation ──────────────────────────────────────────────────────────────

function buildSimpleAllocations(member, selectedMonth, totalAmount) {
  var allocations = [];
  var remaining = parseFloat(totalAmount) || 0;
  if (remaining <= 0) return allocations;

  var dues = parseFloat(member.DuesAmount) || 0;
  var month = normalizeMonthLabel(selectedMonth);
  var outstanding = getMonthOutstanding(member, month);

  if (outstanding > 0) {
    var apply = Math.min(remaining, outstanding);
    allocations.push({
      month: month,
      amountDue: dues,
      amountPaid: apply,
      monthStatus: apply >= outstanding - 0.009 ? 'Paid' : 'Partial'
    });
    remaining -= apply;
  }

  var cursor = parseMonthLabel(month);
  if (!cursor) return allocations;
  cursor = addMonthsDate(cursor, 1);

  while (remaining > 0.009) {
    var futureMonth = formatMonthLabel(cursor);
    var futureOutstanding = getMonthOutstanding(member, futureMonth);
    if (futureOutstanding <= 0) {
      cursor = addMonthsDate(cursor, 1);
      continue;
    }
    var applyFuture = Math.min(remaining, futureOutstanding);
    allocations.push({
      month: futureMonth,
      amountDue: dues,
      amountPaid: applyFuture,
      monthStatus: applyFuture >= futureOutstanding - 0.009 ? 'Paid' : 'Partial'
    });
    remaining -= applyFuture;
    cursor = addMonthsDate(cursor, 1);
  }

  return allocations;
}

function buildAdvancedAllocations(member, allocationList) {
  var allocations = [];
  allocationList.forEach(function (item) {
    var month = normalizeMonthLabel(item.month || item.Month);
    var amount = parseFloat(item.amount || item.Amount) || 0;
    if (!month || amount <= 0) return;
    var dues = parseFloat(member.DuesAmount) || 0;
    var outstanding = getMonthOutstanding(member, month);
    if (outstanding <= 0 && amount > 0) {
      outstanding = dues;
    }
    var monthStatus = amount >= outstanding - 0.009 ? 'Paid' : 'Partial';
    allocations.push({
      month: month,
      amountDue: dues,
      amountPaid: amount,
      monthStatus: monthStatus
    });
  });
  return allocations;
}

function appendPaymentRow(sheet, rowObj) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = headers.map(function (h) {
    return rowObj.hasOwnProperty(h) ? rowObj[h] : '';
  });
  sheet.appendRow(row);
  var lastRow = sheet.getLastRow();
  var monthIdx = headers.indexOf('Month');
  if (monthIdx !== -1 && rowObj.Month) {
    sheet.getRange(lastRow, monthIdx + 1).setNumberFormat('@').setValue(rowObj.Month);
  }
}

function writePaymentBatch(member, batchId, paymentType, allocations, meta) {
  var sheet = getSheet('PAYMENTS');
  var written = [];
  var idx = 1;

  if (paymentType === 'AcceptanceFee') {
    var fee = getMemberAcceptanceFee(member);
    var rowObj = {
      PaymentID: batchId,
      BatchPaymentID: batchId,
      MemberID: String(member.MemberID),
      MemberName: member.FullName,
      PaymentType: 'AcceptanceFee',
      Month: 'Acceptance Fee',
      AmountDue: fee,
      AmountPaid: meta.amountPaid,
      MonthStatus: 'Paid',
      PaymentDate: meta.paymentDate,
      PaymentChannel: meta.channel,
      MoMoReference: meta.momoRef,
      RecordedBy: meta.username,
      Notes: meta.notes
    };
    appendPaymentRow(sheet, rowObj);
    written.push(normalizePaymentRecord(rowObj));
    return written;
  }

  allocations.forEach(function (alloc) {
    var lineId = generateLinePaymentId(batchId, idx++);
    var rowObj = {
      PaymentID: lineId,
      BatchPaymentID: batchId,
      MemberID: String(member.MemberID),
      MemberName: member.FullName,
      PaymentType: 'MonthlyDues',
      Month: alloc.month,
      AmountDue: alloc.amountDue,
      AmountPaid: alloc.amountPaid,
      MonthStatus: alloc.monthStatus,
      PaymentDate: meta.paymentDate,
      PaymentChannel: meta.channel,
      MoMoReference: meta.momoRef,
      RecordedBy: meta.username,
      Notes: meta.notes
    };
    appendPaymentRow(sheet, rowObj);
    written.push(normalizePaymentRecord(rowObj));
  });

  return written;
}

function markAcceptanceFeePaid(memberId, paymentDate) {
  var sheet = getSheet('MEMBERS');
  var row = findRowByColumn(sheet, 0, memberId);
  if (row === -1) return;
  setMemberField(sheet, row, 'AcceptanceFeePaid', 'TRUE');
  setMemberField(sheet, row, 'AcceptanceFeePaidDate', paymentDate || new Date());
}

function revertAcceptanceFeePaid(memberId) {
  var sheet = getSheet('MEMBERS');
  var row = findRowByColumn(sheet, 0, memberId);
  if (row === -1) return;
  setMemberField(sheet, row, 'AcceptanceFeePaid', 'FALSE');
  setMemberField(sheet, row, 'AcceptanceFeePaidDate', '');
}

// ─── recordPayment ───────────────────────────────────────────────────────────

function recordPayment(params, username) {
  migrateDatabase();
  var memberId = params.memberId || params.MemberID;
  if (!memberId) return { success: false, data: {}, error: 'MemberID required' };

  var member = getMemberObject(memberId);
  if (!member) return { success: false, data: {}, error: 'Member not found' };
  if (member.Status === 'Inactive') {
    return { success: false, data: {}, error: 'Inactive members cannot receive payments' };
  }

  var channel = params.paymentChannel || params.PaymentChannel || 'Cash';
  if (channel === 'MoMo' && !(params.momoReference || params.MoMoReference)) {
    return { success: false, data: {}, error: 'MoMo reference required for MoMo payments' };
  }

  var paymentType = params.paymentType || params.PaymentType || 'MonthlyDues';
  var amountPaid = parseFloat(params.amountPaid || params.AmountPaid) || 0;
  var paymentDate = params.paymentDate || params.PaymentDate || new Date();
  var momoRef = channel === 'MoMo' ? (params.momoReference || params.MoMoReference || '') : '';
  var notes = params.notes || params.Notes || '';
  var sheet = getSheet('PAYMENTS');
  var batchId = generateBatchPaymentId(sheet);
  var meta = {
    paymentDate: paymentDate,
    channel: channel,
    momoRef: momoRef,
    username: username,
    notes: notes,
    amountPaid: amountPaid
  };

  var written = [];
  var allocations = [];

  if (paymentType === 'AcceptanceFee') {
    if (!canPayAcceptanceFee(member)) {
      return { success: false, data: {}, error: 'Member cannot pay acceptance fee' };
    }
    if (isAcceptanceFeeComplete(member)) {
      return { success: false, data: {}, error: 'Acceptance fee already paid or waived' };
    }
    var feeRequired = getMemberAcceptanceFee(member);
    if (amountPaid < feeRequired - 0.009) {
      return { success: false, data: {}, error: 'Acceptance fee must be at least GHS ' + feeRequired.toFixed(2) };
    }
    meta.amountPaid = amountPaid;
    written = writePaymentBatch(member, batchId, 'AcceptanceFee', [], meta);
    markAcceptanceFeePaid(memberId, paymentDate);
  } else {
    if (!isMonthlyDuesEligible(member)) {
      return { success: false, data: {}, error: 'Member is not eligible for monthly dues payments' };
    }
    if (amountPaid <= 0) {
      return { success: false, data: {}, error: 'Amount paid must be greater than zero' };
    }

    var mode = params.mode || params.Mode || 'simple';
    if (mode === 'advanced') {
      var raw = params.allocations || params.Allocations || '[]';
      var list = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!list || !list.length) {
        return { success: false, data: {}, error: 'Advanced mode requires month allocations' };
      }
      allocations = buildAdvancedAllocations(member, list);
    } else {
      var month = normalizeMonthLabel(params.month || params.Month || getCurrentMonthLabel());
      allocations = buildSimpleAllocations(member, month, amountPaid);
    }

    if (!allocations.length) {
      return { success: false, data: {}, error: 'No dues could be allocated. Selected month may already be fully paid with no surplus for advance.' };
    }

    written = writePaymentBatch(member, batchId, 'MonthlyDues', allocations, meta);
  }

  var receiptSent = false;
  if (member.Email) {
    try {
      sendPaymentReceiptEmail(member, {
        batchId: batchId,
        paymentType: paymentType,
        totalPaid: amountPaid,
        lines: written,
        paymentDate: paymentDate,
        paymentChannel: channel,
        momoReference: momoRef,
        recordedBy: username,
        notes: notes
      }, getConfigMap());
      receiptSent = true;
      auditLog(username, 'RECEIPT_SENT', 'Receipt emailed to ' + member.Email + ' for ' + batchId);
    } catch (emailErr) {
      auditLog(username, 'RECEIPT_FAILED', batchId + ': ' + String(emailErr.message || emailErr));
    }
  }

  auditLog(username, 'RECORD_PAYMENT', batchId + ' for ' + memberId + ' (' + paymentType + ')');
  return {
    success: true,
    data: {
      batchId: batchId,
      paymentId: batchId,
      receiptSent: receiptSent,
      allocations: written,
      linesCreated: written.length
    },
    error: ''
  };
}

function normalizePaymentRecord(p) {
  var month = p.Month ? normalizeMonthLabel(p.Month) : (p.Month || '');
  return {
    PaymentID: p.PaymentID,
    BatchPaymentID: p.BatchPaymentID || p.PaymentID,
    MemberID: String(p.MemberID || ''),
    MemberName: p.MemberName,
    PaymentType: p.PaymentType || 'MonthlyDues',
    Month: month,
    AmountDue: p.AmountDue,
    AmountPaid: p.AmountPaid,
    MonthStatus: p.MonthStatus || '',
    PaymentDate: p.PaymentDate,
    PaymentChannel: p.PaymentChannel,
    MoMoReference: p.MoMoReference || '',
    RecordedBy: p.RecordedBy,
    Notes: p.Notes || ''
  };
}

function getPayments(params) {
  var payments = getAllPaymentRecords();

  if (params.paymentType || params.PaymentType) {
    payments = payments.filter(function (p) {
      return getPaymentType(p) === String(params.paymentType || params.PaymentType);
    });
  }
  if (params.month || params.Month) {
    var filterMonth = normalizeMonthLabel(params.month || params.Month);
    payments = payments.filter(function (p) {
      return monthsMatch(p.Month, filterMonth);
    });
  }
  if (params.memberId || params.MemberID) {
    payments = payments.filter(function (p) {
      return String(p.MemberID) === String(params.memberId || params.MemberID);
    });
  }
  if (params.channel || params.PaymentChannel) {
    payments = payments.filter(function (p) {
      return String(p.PaymentChannel) === String(params.channel || params.PaymentChannel);
    });
  }

  payments.sort(function (a, b) {
    return new Date(b.PaymentDate) - new Date(a.PaymentDate);
  });

  return { success: true, data: payments, error: '' };
}

function getPaymentsByMember(params, sessionMemberId, role) {
  var memberId = params.memberId || params.MemberID || sessionMemberId;
  params.memberId = memberId;
  return getPayments(params);
}

function deletePayment(params, username) {
  var paymentId = params.paymentId || params.PaymentID;
  var reason = params.reason || params.Reason || 'No reason given';
  if (!paymentId) return { success: false, data: {}, error: 'PaymentID required' };

  var sheet = getSheet('PAYMENTS');
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return { success: false, data: {}, error: 'Payment not found' };

  var headers = data[0];
  var batchIdx = headers.indexOf('BatchPaymentID');
  var typeIdx = headers.indexOf('PaymentType');
  var memberIdx = headers.indexOf('MemberID');
  var targetBatch = paymentId;
  var hadAcceptanceFee = false;
  var memberId = '';

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(paymentId)) {
      targetBatch = batchIdx !== -1 && data[i][batchIdx] ? String(data[i][batchIdx]) : String(paymentId);
      if (typeIdx !== -1 && data[i][typeIdx] === 'AcceptanceFee') hadAcceptanceFee = true;
      if (memberIdx !== -1) memberId = String(data[i][memberIdx]);
      break;
    }
  }

  var deleted = 0;
  for (var r = data.length - 1; r >= 1; r--) {
    var rowBatch = batchIdx !== -1 ? String(data[r][batchIdx]) : String(data[r][0]);
    var rowId = String(data[r][0]);
    if (rowBatch === targetBatch || rowId === paymentId) {
      if (typeIdx !== -1 && data[r][typeIdx] === 'AcceptanceFee') hadAcceptanceFee = true;
      if (memberIdx !== -1 && !memberId) memberId = String(data[r][memberIdx]);
      sheet.deleteRow(r + 1);
      deleted++;
    }
  }

  if (deleted === 0) return { success: false, data: {}, error: 'Payment not found' };
  if (hadAcceptanceFee && memberId) revertAcceptanceFeePaid(memberId);

  auditLog(username, 'DELETE_PAYMENT', targetBatch + ' (' + deleted + ' lines) - Reason: ' + reason);
  return { success: true, data: { paymentId: paymentId, batchId: targetBatch, deleted: deleted }, error: '' };
}

// ─── Reports ─────────────────────────────────────────────────────────────────

function getEligibleMembers() {
  return sheetToObjects(getSheet('MEMBERS')).filter(function (m) {
    return isMonthlyDuesEligible(m);
  });
}

function enrichMemberMonthStatus(member, month) {
  var dues = parseFloat(member.DuesAmount) || 0;
  var paid = getTotalPaidForMonth(member.MemberID, month);
  var status = getMemberMonthStatus(member, month);
  return {
    MemberID: member.MemberID,
    FullName: member.FullName,
    Email: member.Email,
    Phone: member.Phone,
    DuesAmount: dues,
    AmountPaid: paid,
    Outstanding: Math.max(0, dues - paid),
    Status: status
  };
}

function getMonthlySummary(params) {
  var month = normalizeMonthLabel(params.month || params.Month || getCurrentMonthLabel());
  var eligible = getEligibleMembers();
  var paidMembers = [];
  var partialMembers = [];
  var unpaidMembers = [];
  var totalCollected = 0;
  var totalExpected = 0;

  eligible.forEach(function (m) {
    var dues = parseFloat(m.DuesAmount) || 0;
    totalExpected += dues;
    var enriched = enrichMemberMonthStatus(m, month);
    totalCollected += enriched.AmountPaid;

    if (enriched.Status === 'Paid') paidMembers.push(enriched);
    else if (enriched.Status === 'Partial') partialMembers.push(enriched);
    else unpaidMembers.push(enriched);
  });

  return {
    success: true,
    data: {
      month: month,
      eligibleCount: eligible.length,
      paidCount: paidMembers.length,
      partialCount: partialMembers.length,
      unpaidCount: unpaidMembers.length,
      totalCollected: totalCollected,
      totalOutstanding: Math.max(0, totalExpected - totalCollected),
      totalExpected: totalExpected,
      paidMembers: paidMembers,
      partialMembers: partialMembers,
      unpaidMembers: unpaidMembers
    },
    error: ''
  };
}

function getMemberDuesStatus(params, sessionMemberId, role) {
  var memberId = params.memberId || params.MemberID || sessionMemberId;
  var member = getMemberObject(memberId);
  if (!member) return { success: false, data: {}, error: 'Member not found' };

  var now = new Date();
  var monthGrid = [];
  var arrears = [];
  var advance = [];

  for (var i = -12; i <= 12; i++) {
    var d = addMonthsDate(now, i);
    var label = formatMonthLabel(d);
    var entry = {
      month: label,
      amountDue: isMonthlyDuesEligible(member) ? (parseFloat(member.DuesAmount) || 0) : 0,
      amountPaid: isMonthlyDuesEligible(member) ? getTotalPaidForMonth(memberId, label) : 0,
      status: getMemberMonthStatus(member, label)
    };
    entry.outstanding = Math.max(0, entry.amountDue - entry.amountPaid);
    monthGrid.push(entry);

    if (isMonthlyDuesEligible(member)) {
      if (i < 0 && (entry.status === 'Unpaid' || entry.status === 'Partial')) {
        arrears.push({
          month: label,
          outstanding: entry.outstanding,
          amountPaid: entry.amountPaid,
          amountDue: entry.amountDue
        });
      }
      if (i > 0 && entry.amountPaid > 0) {
        advance.push({
          month: label,
          amountPaid: entry.amountPaid,
          amountDue: entry.amountDue,
          status: entry.status
        });
      }
    }
  }

  return {
    success: true,
    data: {
      member: member,
      acceptanceFee: {
        amount: getMemberAcceptanceFee(member),
        paid: String(member.AcceptanceFeePaid).toUpperCase() === 'TRUE',
        waived: String(member.AcceptanceFeeWaived).toUpperCase() === 'TRUE',
        paidDate: member.AcceptanceFeePaidDate || '',
        required: canPayAcceptanceFee(member) && !isAcceptanceFeeComplete(member)
      },
      monthGrid: monthGrid,
      arrears: arrears,
      advance: advance,
      currentMonth: getCurrentMonthLabel(),
      currentMonthStatus: getMemberMonthStatus(member, getCurrentMonthLabel())
    },
    error: ''
  };
}

function getMemberHistory(params, sessionMemberId, role) {
  var memberId = params.memberId || params.MemberID || sessionMemberId;
  var member = getMemberObject(memberId);
  if (!member) return { success: false, data: {}, error: 'Member not found' };

  var payments = getAllPaymentRecords().filter(function (p) {
    return String(p.MemberID) === String(memberId);
  });

  payments.sort(function (a, b) {
    return new Date(b.PaymentDate) - new Date(a.PaymentDate);
  });

  var year = new Date().getFullYear();
  var maxMonth = new Date().getMonth() + 1;
  var monthsPaid = 0;
  var totalPaid = 0;

  for (var m = 0; m < maxMonth; m++) {
    var label = formatMonthLabel(new Date(year, m, 1));
    if (getMemberMonthStatus(member, label) === 'Paid') monthsPaid++;
  }

  payments.forEach(function (p) {
    totalPaid += parseFloat(p.AmountPaid) || 0;
  });

  var monthsMissed = Math.max(0, maxMonth - monthsPaid);
  var compliance = maxMonth > 0 ? Math.round((monthsPaid / maxMonth) * 100) : 0;

  var duesStatus = getMemberDuesStatus({ memberId: memberId }, memberId, role);

  return {
    success: true,
    data: {
      member: member,
      payments: payments,
      totalPaid: totalPaid,
      monthsPaid: monthsPaid,
      monthsMissed: monthsMissed,
      compliance: compliance,
      acceptanceFee: duesStatus.data.acceptanceFee,
      monthGrid: duesStatus.data.monthGrid,
      arrears: duesStatus.data.arrears,
      advance: duesStatus.data.advance
    },
    error: ''
  };
}

function getOverdueMembers(params) {
  var month = normalizeMonthLabel(params.month || params.Month || getCurrentMonthLabel());
  var config = getConfigMap();
  var deadlineDay = parseInt(config.DeadlineDay, 10) || 31;
  var now = new Date();
  var monthDate = parseMonthLabel(month);
  if (!monthDate) monthDate = new Date(now.getFullYear(), now.getMonth(), 1);

  var deadline = new Date(monthDate.getFullYear(), monthDate.getMonth(), deadlineDay, 23, 59, 59);
  if (now <= deadline) {
    return {
      success: true,
      data: { month: month, overdueMembers: [], isPastDeadline: false },
      error: ''
    };
  }

  var summary = getMonthlySummary({ month: month });
  var overdue = [];

  summary.data.unpaidMembers.forEach(function (m) {
    overdue.push({
      MemberID: m.MemberID,
      FullName: m.FullName,
      Email: m.Email,
      Phone: m.Phone,
      AmountOverdue: m.Outstanding || m.DuesAmount,
      MonthsOverdue: 1
    });
  });
  summary.data.partialMembers.forEach(function (m) {
    overdue.push({
      MemberID: m.MemberID,
      FullName: m.FullName,
      Email: m.Email,
      Phone: m.Phone,
      AmountOverdue: m.Outstanding,
      MonthsOverdue: 1
    });
  });

  return {
    success: true,
    data: { month: month, overdueMembers: overdue, isPastDeadline: true },
    error: ''
  };
}

function getYearEndSummary(params) {
  var year = parseInt(params.year || params.Year || new Date().getFullYear(), 10);
  var members = getEligibleMembers();
  var now = new Date();
  var maxMonth = year < now.getFullYear() ? 12 : now.getMonth() + 1;

  var memberSummaries = [];
  var totalCollected = 0;
  var totalExpected = 0;

  members.forEach(function (m) {
    var monthsPaid = 0;
    var totalPaid = 0;

    for (var i = 0; i < maxMonth; i++) {
      var label = formatMonthLabel(new Date(year, i, 1));
      var status = getMemberMonthStatus(m, label);
      var paid = getTotalPaidForMonth(m.MemberID, label);
      totalPaid += paid;
      if (status === 'Paid') monthsPaid++;
    }

    var monthsMissed = maxMonth - monthsPaid;
    var expected = (parseFloat(m.DuesAmount) || 0) * maxMonth;
    var compliance = maxMonth > 0 ? Math.round((monthsPaid / maxMonth) * 100) : 0;

    totalCollected += totalPaid;
    totalExpected += expected;

    memberSummaries.push({
      MemberID: m.MemberID,
      FullName: m.FullName,
      monthsPaid: monthsPaid,
      monthsMissed: monthsMissed,
      totalPaid: totalPaid,
      compliance: compliance
    });
  });

  var familyCompliance = totalExpected > 0
    ? Math.round((totalCollected / totalExpected) * 100)
    : 0;

  return {
    success: true,
    data: {
      year: year,
      members: memberSummaries,
      totalCollected: totalCollected,
      totalExpected: totalExpected,
      familyCompliance: familyCompliance
    },
    error: ''
  };
}

function aggregateCollectionStats(payments) {
  var totalCollected = 0;
  var monthlyDuesTotal = 0;
  var acceptanceFeeTotal = 0;
  var byChannel = {};
  var byType = {};
  var byPaymentMonth = {};
  var batches = {};

  payments.forEach(function (p) {
    var amt = parseFloat(p.AmountPaid) || 0;
    totalCollected += amt;
    var type = getPaymentType(p);
    if (type === 'AcceptanceFee') acceptanceFeeTotal += amt;
    else monthlyDuesTotal += amt;

    var channel = String(p.PaymentChannel || 'Unknown');
    if (!byChannel[channel]) byChannel[channel] = { channel: channel, amount: 0, count: 0 };
    byChannel[channel].amount += amt;
    byChannel[channel].count++;

    if (!byType[type]) byType[type] = { type: type, amount: 0, count: 0 };
    byType[type].amount += amt;
    byType[type].count++;

    var payDate = new Date(p.PaymentDate);
    if (!isNaN(payDate.getTime())) {
      var monthLabel = formatMonthLabel(payDate);
      if (!byPaymentMonth[monthLabel]) {
        byPaymentMonth[monthLabel] = { month: monthLabel, amount: 0, count: 0, sortKey: payDate.getTime() };
      }
      byPaymentMonth[monthLabel].amount += amt;
      byPaymentMonth[monthLabel].count++;
    }

    var batchId = String(p.BatchPaymentID || p.PaymentID || '');
    if (batchId) batches[batchId] = true;
  });

  var monthBreakdown = Object.keys(byPaymentMonth).map(function (k) {
    return byPaymentMonth[k];
  }).sort(function (a, b) {
    return b.sortKey - a.sortKey;
  }).map(function (entry) {
    return { month: entry.month, amount: entry.amount, count: entry.count };
  });

  return {
    totalCollected: totalCollected,
    monthlyDuesTotal: monthlyDuesTotal,
    acceptanceFeeTotal: acceptanceFeeTotal,
    paymentCount: payments.length,
    batchCount: Object.keys(batches).length,
    byChannel: Object.keys(byChannel).map(function (k) { return byChannel[k]; })
      .sort(function (a, b) { return b.amount - a.amount; }),
    byType: Object.keys(byType).map(function (k) { return byType[k]; })
      .sort(function (a, b) { return b.amount - a.amount; }),
    byPaymentMonth: monthBreakdown
  };
}

function filterPaymentsByYear(payments, year) {
  if (!year || year === 'all') return payments;
  var y = parseInt(year, 10);
  if (isNaN(y)) return payments;
  return payments.filter(function (p) {
    var d = new Date(p.PaymentDate);
    return !isNaN(d.getTime()) && d.getFullYear() === y;
  });
}

function getTotalCollections(params) {
  var year = params.year || params.Year || 'all';
  return {
    success: true,
    data: buildFinancialSummary(year),
    error: ''
  };
}

function buildFinancialSummary(year) {
  var payments = getAllPaymentRecords();
  var disbursements = getAllDisbursementRecords();
  payments = filterPaymentsByYear(payments, year);
  disbursements = filterDisbursementsByYear(disbursements, year);
  payments.sort(function (a, b) {
    return new Date(b.PaymentDate) - new Date(a.PaymentDate);
  });
  disbursements.sort(function (a, b) {
    return new Date(b.DisbursementDate) - new Date(a.DisbursementDate);
  });

  var collectionStats = aggregateCollectionStats(payments);
  var disbursementStats = aggregateDisbursementStats(disbursements);
  var period = year === 'all' || !year ? 'All Time' : String(year);

  return Object.assign({
    period: period,
    year: year,
    payments: payments,
    disbursements: disbursements,
    netBalance: collectionStats.totalCollected - disbursementStats.totalDisbursements
  }, collectionStats, disbursementStats);
}

function getDashboardData(params, sessionMemberId, role) {
  var month = getCurrentMonthLabel();
  var config = getConfigMap();
  var year = params.year || params.Year || 'all';
  var result = {
    month: month,
    year: new Date().getFullYear(),
    familyName: config.FamilyName || 'Family Dues',
    financialPeriod: year === 'all' || !year ? 'All Time' : String(year)
  };

  if (role === 'Admin' || role === 'Treasurer') {
    var summary = getMonthlySummary({ month: month });
    result.summary = summary.data;

    var financial = buildFinancialSummary(year);
    result.totalCollections = {
      totalCollected: financial.totalCollected,
      monthlyDuesTotal: financial.monthlyDuesTotal,
      acceptanceFeeTotal: financial.acceptanceFeeTotal,
      paymentCount: financial.paymentCount,
      batchCount: financial.batchCount
    };
    result.totalDisbursements = {
      totalDisbursements: financial.totalDisbursements,
      disbursementCount: financial.disbursementCount
    };
    result.netBalance = financial.netBalance;

    var chartData = [];
    var now = new Date();
    for (var i = 5; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      var label = formatMonthLabel(d);
      var s = getMonthlySummary({ month: label });
      chartData.push({ month: label, collected: s.data.totalCollected });
    }
    result.chartData = chartData;
  }

  if (role === 'Secretary') {
    var allMembers = sheetToObjects(getSheet('MEMBERS'));
    result.activeCount = allMembers.filter(function (m) { return m.Status === 'Active'; }).length;
    result.exemptCount = allMembers.filter(function (m) { return m.Status === 'Exempt'; }).length;
  }

  if (sessionMemberId) {
    var duesStatus = getMemberDuesStatus({ memberId: sessionMemberId }, sessionMemberId, role);
    result.memberDuesStatus = duesStatus.data;
    var member = getMemberObject(sessionMemberId);
    if (member) {
      var status = duesStatus.data.currentMonthStatus;
      result.memberDues = {
        amount: parseFloat(member.DuesAmount) || 0,
        status: member.Status === 'Exempt' ? 'EXEMPT' : status.toUpperCase(),
        memberName: member.FullName
      };
    }
    var history = getMemberHistory({ memberId: sessionMemberId }, sessionMemberId, role);
    result.paymentHistory = history.data.monthGrid || [];
    result.acceptanceFee = history.data.acceptanceFee;
    result.arrears = history.data.arrears;
    result.advance = history.data.advance;
  }

  return { success: true, data: result, error: '' };
}

// ─── Disbursements ───────────────────────────────────────────────────────────

function getAllDisbursementRecords() {
  migrateDatabase();
  var sheet = getSpreadsheet().getSheetByName('DISBURSEMENTS');
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheetToObjects(sheet).map(normalizeDisbursementRecord);
}

function normalizeDisbursementRecord(d) {
  return {
    DisbursementID: String(d.DisbursementID || ''),
    Amount: parseFloat(d.Amount) || 0,
    Purpose: d.Purpose || '',
    DisbursementDate: d.DisbursementDate,
    Channel: d.Channel || '',
    RecordedBy: d.RecordedBy || '',
    Notes: d.Notes || ''
  };
}

function generateDisbursementId(sheet) {
  var year = new Date().getFullYear();
  var prefix = 'DIS-' + year + '-';
  var data = sheet.getDataRange().getValues();
  var maxNum = 0;
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][0] || '');
    if (id.indexOf(prefix) === 0) {
      var num = parseInt(id.replace(prefix, ''), 10);
      if (!isNaN(num)) maxNum = Math.max(maxNum, num);
    }
  }
  return prefix + ('000' + (maxNum + 1)).slice(-3);
}

function filterDisbursementsByYear(disbursements, year) {
  if (!year || year === 'all') return disbursements;
  var y = parseInt(year, 10);
  if (isNaN(y)) return disbursements;
  return disbursements.filter(function (d) {
    var date = new Date(d.DisbursementDate);
    return !isNaN(date.getTime()) && date.getFullYear() === y;
  });
}

function aggregateDisbursementStats(disbursements) {
  var totalDisbursements = 0;
  var byChannel = {};

  disbursements.forEach(function (d) {
    var amt = parseFloat(d.Amount) || 0;
    totalDisbursements += amt;
    var channel = String(d.Channel || 'Unknown');
    if (!byChannel[channel]) byChannel[channel] = { channel: channel, amount: 0, count: 0 };
    byChannel[channel].amount += amt;
    byChannel[channel].count++;
  });

  return {
    totalDisbursements: totalDisbursements,
    disbursementCount: disbursements.length,
    disbursementsByChannel: Object.keys(byChannel).map(function (k) { return byChannel[k]; })
      .sort(function (a, b) { return b.amount - a.amount; })
  };
}

function recordDisbursement(params, username) {
  migrateDatabase();
  var amount = parseFloat(params.amount || params.Amount);
  var purpose = String(params.purpose || params.Purpose || '').trim();
  var channel = String(params.channel || params.Channel || 'Cash').trim();
  var notes = String(params.notes || params.Notes || '').trim();
  var dateInput = params.disbursementDate || params.DisbursementDate;

  if (!amount || amount <= 0) return { success: false, data: {}, error: 'Valid amount required' };
  if (!purpose) return { success: false, data: {}, error: 'Purpose is required' };
  if (['Cash', 'MoMo', 'Bank'].indexOf(channel) === -1) {
    return { success: false, data: {}, error: 'Channel must be Cash, MoMo, or Bank' };
  }

  var disbursementDate = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(disbursementDate.getTime())) {
    return { success: false, data: {}, error: 'Invalid disbursement date' };
  }

  var sheet = getSheet('DISBURSEMENTS');
  var disbursementId = generateDisbursementId(sheet);
  sheet.appendRow([
    disbursementId,
    amount,
    purpose,
    disbursementDate,
    channel,
    username,
    notes
  ]);

  auditLog(username, 'RECORD_DISBURSEMENT', disbursementId + ' — ' + purpose + ' — GHS ' + amount);
  return {
    success: true,
    data: normalizeDisbursementRecord({
      DisbursementID: disbursementId,
      Amount: amount,
      Purpose: purpose,
      DisbursementDate: disbursementDate,
      Channel: channel,
      RecordedBy: username,
      Notes: notes
    }),
    error: ''
  };
}

function getDisbursements(params) {
  var year = params.year || params.Year || 'all';
  var disbursements = getAllDisbursementRecords();
  disbursements = filterDisbursementsByYear(disbursements, year);
  disbursements.sort(function (a, b) {
    return new Date(b.DisbursementDate) - new Date(a.DisbursementDate);
  });

  var stats = aggregateDisbursementStats(disbursements);
  return {
    success: true,
    data: Object.assign({
      period: year === 'all' || !year ? 'All Time' : String(year),
      year: year,
      disbursements: disbursements
    }, stats),
    error: ''
  };
}

function deleteDisbursement(params, username) {
  var disbursementId = params.disbursementId || params.DisbursementID;
  var reason = params.reason || params.Reason || 'No reason given';
  if (!disbursementId) return { success: false, data: {}, error: 'DisbursementID required' };

  var sheet = getSheet('DISBURSEMENTS');
  var row = findRowByColumn(sheet, 0, disbursementId);
  if (row === -1) return { success: false, data: {}, error: 'Disbursement not found' };

  sheet.deleteRow(row);
  auditLog(username, 'DELETE_DISBURSEMENT', disbursementId + ' - Reason: ' + reason);
  return { success: true, data: { disbursementId: disbursementId }, error: '' };
}
