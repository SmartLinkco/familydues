/**
 * Family Dues Management System — Google Apps Script Backend
 * Deploy as Web App: Execute as Me, Access: Anyone
 */

var SPREADSHEET_NAME = 'FamilyDuesDB';
var SESSION_HOURS = 8;

// ─── Entry Points ───────────────────────────────────────────────────────────

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    var params = parseParams(e);
    var action = params.action || '';

    if (action === 'login') {
      return jsonResponse(handleLogin(params));
    }

    if (action === 'getConfig') {
      return jsonResponse(getConfig());
    }

    if (action === 'setupDatabase') {
      return jsonResponse(setupDatabase());
    }

    var session = validateSession(params.token);
    if (!session.valid) {
      return jsonResponse({ success: false, data: {}, error: session.error || 'Unauthorized' });
    }

    var username = session.username || '';
    var role = session.role || '';
    var memberId = session.memberId || '';

    if (!checkPermission(action, role, params, memberId)) {
      return jsonResponse({ success: false, data: {}, error: 'Permission denied' });
    }

    var result;
    switch (action) {
      case 'getConfig':
        result = getConfig();
        break;
      case 'addMember':
        result = addMember(params, username);
        break;
      case 'updateMember':
        result = updateMember(params, username);
        break;
      case 'deleteMember':
        result = deleteMember(params, username);
        break;
      case 'getMembers':
        result = getMembers(params);
        break;
      case 'getMemberById':
        result = getMemberById(params);
        break;
      case 'createUser':
        result = createUser(params, username);
        break;
      case 'updateUserRole':
        result = updateUserRole(params, username);
        break;
      case 'resetPassword':
        result = resetPassword(params, username);
        break;
      case 'toggleUserActive':
        result = toggleUserActive(params, username);
        break;
      case 'getUsers':
        result = getUsers();
        break;
      case 'recordPayment':
        result = recordPayment(params, username);
        break;
      case 'getPayments':
        result = getPayments(params);
        break;
      case 'getPaymentsByMember':
        result = getPaymentsByMember(params, memberId, role);
        break;
      case 'deletePayment':
        result = deletePayment(params, username);
        break;
      case 'getMonthlySummary':
        result = getMonthlySummary(params);
        break;
      case 'getMemberHistory':
        result = getMemberHistory(params, memberId, role);
        break;
      case 'getOverdueMembers':
        result = getOverdueMembers(params);
        break;
      case 'getYearEndSummary':
        result = getYearEndSummary(params);
        break;
      case 'getDashboardData':
        result = getDashboardData(params, memberId, role);
        break;
      case 'sendReminders':
        result = sendReminders(params, username);
        break;
      case 'sendReminderToMember':
        result = sendReminderToMember(params, username);
        break;
      default:
        result = { success: false, data: {}, error: 'Unknown action: ' + action };
    }

    if (session.valid && action !== 'login') {
      touchSession(params.token);
    }

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ success: false, data: {}, error: String(err.message || err) });
  }
}

function parseParams(e) {
  var params = {};
  if (e && e.parameter) {
    for (var key in e.parameter) {
      if (e.parameter.hasOwnProperty(key)) {
        params[key] = e.parameter[key];
      }
    }
  }
  if (e && e.postData && e.postData.contents) {
    var body = e.postData.contents;
    if (e.postData.type && e.postData.type.indexOf('application/json') !== -1) {
      try {
        var json = JSON.parse(body);
        for (var k in json) {
          if (json.hasOwnProperty(k)) params[k] = json[k];
        }
      } catch (ex) { /* ignore */ }
    } else {
      body.split('&').forEach(function (pair) {
        var parts = pair.split('=');
        if (parts.length === 2) {
          params[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1].replace(/\+/g, ' '));
        }
      });
    }
  }
  return params;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── Phase 1: Database Setup ────────────────────────────────────────────────

function setupDatabase() {
  var ss = getOrCreateSpreadsheet();
  createSheetWithHeaders(ss, 'MEMBERS', [
    'MemberID', 'FullName', 'Email', 'Phone', 'DateOfBirth', 'Status',
    'ExemptionReason', 'DuesAmount', 'DateAdded', 'AddedBy', 'Notes'
  ]);
  createSheetWithHeaders(ss, 'USERS', [
    'UserID', 'MemberID', 'Username', 'PasswordHash', 'Role',
    'CreatedDate', 'LastLogin', 'IsActive'
  ]);
  createSheetWithHeaders(ss, 'PAYMENTS', [
    'PaymentID', 'MemberID', 'MemberName', 'Month', 'AmountDue', 'AmountPaid',
    'PaymentDate', 'PaymentChannel', 'MoMoReference', 'RecordedBy', 'Notes'
  ]);
  createSheetWithHeaders(ss, 'DUES_CONFIG', ['ConfigKey', 'ConfigValue']);
  createSheetWithHeaders(ss, 'AUDIT_LOG', [
    'Timestamp', 'Username', 'Action', 'Details', 'IPAddress'
  ]);
  createSheetWithHeaders(ss, 'SESSIONS', [
    'Token', 'UserID', 'Username', 'Role', 'MemberID', 'CreatedAt', 'LastActivity', 'ExpiresAt'
  ]);

  seedConfig(ss);
  seedAdminUser(ss);

  return {
    success: true,
    data: { spreadsheetId: ss.getId(), spreadsheetUrl: ss.getUrl() },
    error: ''
  };
}

function getOrCreateSpreadsheet() {
  var files = DriveApp.getFilesByName(SPREADSHEET_NAME);
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  }
  var ss = SpreadsheetApp.create(SPREADSHEET_NAME);
  return ss;
}

function createSheetWithHeaders(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function seedConfig(ss) {
  var sheet = ss.getSheetByName('DUES_CONFIG');
  var existing = sheet.getDataRange().getValues();
  if (existing.length > 1) return;

  var defaults = [
    ['DeadlineDay', '31'],
    ['CurrencySymbol', 'GHS'],
    ['FamilyName', 'Asempa Royal Family'],
    ['SystemEmail', Session.getActiveUser().getEmail() || ''],
    ['ReminderDaysBefore', '5'],
    ['ElderlyAgeThreshold', '60'],
    ['MoMoNumber', '0240000000'],
    ['TreasurerEmail', ''],
    ['LoginUrl', 'https://your-frontend-url.com/index.html']
  ];
  defaults.forEach(function (row) {
    sheet.appendRow(row);
  });
}

function seedAdminUser(ss) {
  var sheet = ss.getSheetByName('USERS');
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][2] === 'admin') return;
  }
  var now = new Date();
  sheet.appendRow([
    'USR001', '', 'admin', hashPassword('Admin@1234'), 'Admin',
    formatDateISO(now), '', 'TRUE'
  ]);
}

function getConfigMap() {
  var sheet = getSheet('DUES_CONFIG');
  var data = sheet.getDataRange().getValues();
  var config = {};
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) config[String(data[i][0])] = String(data[i][1]);
  }
  return config;
}

function getConfig() {
  return { success: true, data: getConfigMap(), error: '' };
}

// ─── Spreadsheet Helpers ────────────────────────────────────────────────────

function getSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  var files = DriveApp.getFilesByName(SPREADSHEET_NAME);
  if (files.hasNext()) return SpreadsheetApp.open(files.next());
  throw new Error('Spreadsheet "' + SPREADSHEET_NAME + '" not found. Run setupDatabase first.');
}

function getSheet(name) {
  var sheet = getSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name);
  return sheet;
}

function sheetToObjects(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    rows.push(obj);
  }
  return rows;
}

function findRowByColumn(sheet, colIndex, value) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colIndex]) === String(value)) return i + 1;
  }
  return -1;
}

// ─── Security ───────────────────────────────────────────────────────────────

function hashPassword(password) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(password));
  return digest.map(function (b) {
    var v = b < 0 ? b + 256 : b;
    return ('0' + v.toString(16)).slice(-2);
  }).join('');
}

function generateId(prefix, sheet, colIndex, pad) {
  pad = pad || 3;
  var data = sheet.getDataRange().getValues();
  var maxNum = 0;
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][colIndex] || '');
    var match = id.match(new RegExp('^' + prefix + '(\\d+)$'));
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }
  var num = maxNum + 1;
  return prefix + ('000' + num).slice(-pad);
}

function generatePaymentId(sheet) {
  var year = new Date().getFullYear();
  var prefix = 'PAY-' + year + '-';
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

function validateSession(token) {
  if (!token) return { valid: false, error: 'No session token provided' };
  var sheet = getSheet('SESSIONS');
  var data = sheet.getDataRange().getValues();
  var now = new Date();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(token)) {
      var expiresAt = new Date(data[i][7]);
      if (now > expiresAt) {
        sheet.deleteRow(i + 1);
        return { valid: false, error: 'Session expired' };
      }
      return {
        valid: true,
        userId: data[i][1],
        username: data[i][2],
        role: data[i][3],
        memberId: data[i][4]
      };
    }
  }
  return { valid: false, error: 'Invalid session token' };
}

function touchSession(token) {
  var sheet = getSheet('SESSIONS');
  var row = findRowByColumn(sheet, 0, token);
  if (row === -1) return;
  var now = new Date();
  var expires = new Date(now.getTime() + SESSION_HOURS * 60 * 60 * 1000);
  sheet.getRange(row, 7).setValue(now);
  sheet.getRange(row, 8).setValue(expires);
}

function createSession(user) {
  var token = Utilities.getUuid();
  var now = new Date();
  var expires = new Date(now.getTime() + SESSION_HOURS * 60 * 60 * 1000);
  var sheet = getSheet('SESSIONS');
  sheet.appendRow([
    token, user.UserID, user.Username, user.Role, user.MemberID || '',
    now, now, expires
  ]);
  return token;
}

function checkPermission(action, role, params, memberId) {
  var adminActions = ['setupDatabase', 'getConfig', 'addMember', 'updateMember', 'deleteMember',
    'getMembers', 'getMemberById', 'createUser', 'updateUserRole', 'resetPassword',
    'toggleUserActive', 'getUsers', 'recordPayment', 'getPayments', 'getPaymentsByMember',
    'deletePayment', 'getMonthlySummary', 'getMemberHistory', 'getOverdueMembers',
    'getYearEndSummary', 'getDashboardData', 'sendReminders', 'sendReminderToMember'];

  var treasurerActions = ['getConfig', 'getMembers', 'getMemberById', 'recordPayment',
    'getPayments', 'getPaymentsByMember', 'deletePayment', 'getMonthlySummary',
    'getMemberHistory', 'getOverdueMembers', 'getYearEndSummary', 'getDashboardData',
    'sendReminderToMember'];

  var secretaryActions = ['getConfig', 'addMember', 'updateMember', 'getMembers',
    'getMemberById', 'getDashboardData', 'sendReminders', 'sendReminderToMember'];

  var memberActions = ['getConfig', 'getPaymentsByMember', 'getMemberHistory', 'getDashboardData'];

  var allowed = [];
  if (role === 'Admin') allowed = adminActions;
  else if (role === 'Treasurer') allowed = treasurerActions;
  else if (role === 'Secretary') allowed = secretaryActions;
  else if (role === 'Member') allowed = memberActions;

  if (allowed.indexOf(action) === -1) return false;

  if (role === 'Member') {
    if (action === 'getPaymentsByMember' || action === 'getMemberHistory') {
      var targetId = params.memberId || params.MemberID || memberId;
      if (String(targetId) !== String(memberId)) return false;
    }
  }

  return true;
}

function auditLog(username, action, details) {
  var sheet = getSheet('AUDIT_LOG');
  sheet.appendRow([new Date(), username || 'system', action, details || '', '']);
}

// ─── AUTH ───────────────────────────────────────────────────────────────────

function handleLogin(params) {
  var username = (params.username || '').trim();
  var password = params.password || '';
  if (!username || !password) {
    return { success: false, data: {}, error: 'Username and password required' };
  }

  var sheet = getSheet('USERS');
  var data = sheet.getDataRange().getValues();
  var userRow = -1;
  var user = null;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][2]).toLowerCase() === username.toLowerCase()) {
      userRow = i + 1;
      user = {
        UserID: data[i][0],
        MemberID: data[i][1],
        Username: data[i][2],
        PasswordHash: data[i][3],
        Role: data[i][4],
        CreatedDate: data[i][5],
        LastLogin: data[i][6],
        IsActive: String(data[i][7]).toUpperCase() === 'TRUE'
      };
      break;
    }
  }

  if (!user) return { success: false, data: {}, error: 'Invalid username or password' };
  if (!user.IsActive) return { success: false, data: {}, error: 'Account is disabled' };

  var hash = hashPassword(password);
  if (hash !== user.PasswordHash) {
    return { success: false, data: {}, error: 'Invalid username or password' };
  }

  sheet.getRange(userRow, 7).setValue(new Date());
  var token = createSession(user);
  auditLog(username, 'LOGIN', 'User logged in');

  var memberName = username;
  if (user.MemberID) {
    var member = getMemberObject(user.MemberID);
    if (member) memberName = member.FullName;
  }

  var config = getConfigMap();

  return {
    success: true,
    data: {
      token: token,
      userId: user.UserID,
      username: user.Username,
      role: user.Role,
      memberId: user.MemberID || '',
      memberName: memberName,
      familyName: config.FamilyName || 'Family Dues'
    },
    error: ''
  };
}

function getMemberObject(memberId) {
  var sheet = getSheet('MEMBERS');
  var row = findRowByColumn(sheet, 0, memberId);
  if (row === -1) return null;
  var data = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var obj = {};
  headers.forEach(function (h, i) { obj[h] = data[i]; });
  return obj;
}

// ─── MEMBERS ────────────────────────────────────────────────────────────────

function addMember(params, username) {
  var sheet = getSheet('MEMBERS');
  var memberId = generateId('FM', sheet, 0, 3);
  var now = new Date();
  var status = params.status || 'Active';
  var exemption = params.exemptionReason || params.ExemptionReason || 'none';

  sheet.appendRow([
    memberId,
    params.fullName || params.FullName || '',
    params.email || params.Email || '',
    params.phone || params.Phone || '',
    params.dateOfBirth || params.DateOfBirth || '',
    status,
    exemption,
    parseFloat(params.duesAmount || params.DuesAmount || 0),
    now,
    username,
    params.notes || params.Notes || ''
  ]);

  auditLog(username, 'ADD_MEMBER', 'Added member ' + memberId);
  return { success: true, data: { memberId: memberId }, error: '' };
}

function updateMember(params, username) {
  var memberId = params.memberId || params.MemberID;
  if (!memberId) return { success: false, data: {}, error: 'MemberID required' };

  var sheet = getSheet('MEMBERS');
  var row = findRowByColumn(sheet, 0, memberId);
  if (row === -1) return { success: false, data: {}, error: 'Member not found' };

  if (params.fullName !== undefined) sheet.getRange(row, 2).setValue(params.fullName);
  if (params.FullName !== undefined) sheet.getRange(row, 2).setValue(params.FullName);
  if (params.email !== undefined) sheet.getRange(row, 3).setValue(params.email);
  if (params.Email !== undefined) sheet.getRange(row, 3).setValue(params.Email);
  if (params.phone !== undefined) sheet.getRange(row, 4).setValue(params.phone);
  if (params.Phone !== undefined) sheet.getRange(row, 4).setValue(params.Phone);
  if (params.dateOfBirth !== undefined) sheet.getRange(row, 5).setValue(params.dateOfBirth);
  if (params.DateOfBirth !== undefined) sheet.getRange(row, 5).setValue(params.DateOfBirth);
  if (params.status !== undefined) sheet.getRange(row, 6).setValue(params.status);
  if (params.Status !== undefined) sheet.getRange(row, 6).setValue(params.Status);
  if (params.exemptionReason !== undefined) sheet.getRange(row, 7).setValue(params.exemptionReason);
  if (params.ExemptionReason !== undefined) sheet.getRange(row, 7).setValue(params.ExemptionReason);
  if (params.duesAmount !== undefined) sheet.getRange(row, 8).setValue(parseFloat(params.duesAmount));
  if (params.DuesAmount !== undefined) sheet.getRange(row, 8).setValue(parseFloat(params.DuesAmount));
  if (params.notes !== undefined) sheet.getRange(row, 11).setValue(params.notes);
  if (params.Notes !== undefined) sheet.getRange(row, 11).setValue(params.Notes);

  auditLog(username, 'UPDATE_MEMBER', 'Updated member ' + memberId);
  return { success: true, data: { memberId: memberId }, error: '' };
}

function deleteMember(params, username) {
  var memberId = params.memberId || params.MemberID;
  if (!memberId) return { success: false, data: {}, error: 'MemberID required' };

  var sheet = getSheet('MEMBERS');
  var row = findRowByColumn(sheet, 0, memberId);
  if (row === -1) return { success: false, data: {}, error: 'Member not found' };

  sheet.getRange(row, 6).setValue('Inactive');
  auditLog(username, 'DELETE_MEMBER', 'Deactivated member ' + memberId);
  return { success: true, data: { memberId: memberId }, error: '' };
}

function getMembers(params) {
  var members = sheetToObjects(getSheet('MEMBERS'));
  var filter = params.filter || params.status || 'all';

  members = members.filter(function (m) {
    if (filter === 'all') return m.Status !== 'Inactive';
    if (filter === 'Active') return m.Status === 'Active';
    if (filter === 'Exempt') return m.Status === 'Exempt';
    if (filter === 'Inactive') return m.Status === 'Inactive';
    return m.Status !== 'Inactive';
  });

  return { success: true, data: members, error: '' };
}

function getMemberById(params) {
  var memberId = params.memberId || params.MemberID;
  var member = getMemberObject(memberId);
  if (!member) return { success: false, data: {}, error: 'Member not found' };
  return { success: true, data: member, error: '' };
}

// ─── USERS ──────────────────────────────────────────────────────────────────

function getUsers() {
  var users = sheetToObjects(getSheet('USERS'));
  var members = sheetToObjects(getSheet('MEMBERS'));
  var memberMap = {};
  members.forEach(function (m) { memberMap[m.MemberID] = m.FullName; });

  users = users.map(function (u) {
    return {
      UserID: u.UserID,
      MemberID: u.MemberID,
      Username: u.Username,
      Role: u.Role,
      CreatedDate: u.CreatedDate,
      LastLogin: u.LastLogin,
      IsActive: u.IsActive,
      MemberName: memberMap[u.MemberID] || ''
    };
  });

  return { success: true, data: users, error: '' };
}

function createUser(params, username) {
  var sheet = getSheet('USERS');
  var memberId = params.memberId || params.MemberID || '';
  var newUsername = (params.username || params.Username || '').trim();
  var tempPassword = params.password || params.Password || generateTempPassword();
  var role = params.role || params.Role || 'Member';

  if (!newUsername) return { success: false, data: {}, error: 'Username required' };

  var existing = sheetToObjects(sheet);
  for (var i = 0; i < existing.length; i++) {
    if (String(existing[i].Username).toLowerCase() === newUsername.toLowerCase()) {
      return { success: false, data: {}, error: 'Username already exists' };
    }
  }

  var userId = generateId('USR', sheet, 0, 3);
  sheet.appendRow([
    userId, memberId, newUsername, hashPassword(tempPassword), role,
    new Date(), '', 'TRUE'
  ]);

  var member = memberId ? getMemberObject(memberId) : null;
  var email = member ? member.Email : '';
  if (email) {
    sendWelcomeEmail(member.FullName, email, newUsername, tempPassword);
  }

  auditLog(username, 'CREATE_USER', 'Created user ' + newUsername + ' (' + role + ')');
  return { success: true, data: { userId: userId, tempPassword: tempPassword }, error: '' };
}

function updateUserRole(params, username) {
  var userId = params.userId || params.UserID;
  var role = params.role || params.Role;
  if (!userId || !role) return { success: false, data: {}, error: 'UserID and Role required' };

  var sheet = getSheet('USERS');
  var row = findRowByColumn(sheet, 0, userId);
  if (row === -1) return { success: false, data: {}, error: 'User not found' };

  sheet.getRange(row, 5).setValue(role);
  auditLog(username, 'UPDATE_USER_ROLE', 'Changed role for ' + userId + ' to ' + role);
  return { success: true, data: { userId: userId }, error: '' };
}

function resetPassword(params, username) {
  var userId = params.userId || params.UserID;
  if (!userId) return { success: false, data: {}, error: 'UserID required' };

  var sheet = getSheet('USERS');
  var row = findRowByColumn(sheet, 0, userId);
  if (row === -1) return { success: false, data: {}, error: 'User not found' };

  var tempPassword = generateTempPassword();
  sheet.getRange(row, 4).setValue(hashPassword(tempPassword));

  var userData = sheet.getRange(row, 1, 1, 8).getValues()[0];
  var memberId = userData[1];
  var targetUsername = userData[2];
  var member = memberId ? getMemberObject(memberId) : null;
  if (member && member.Email) {
    sendPasswordResetEmail(member.FullName, member.Email, targetUsername, tempPassword);
  }

  auditLog(username, 'RESET_PASSWORD', 'Reset password for user ' + userId);
  return { success: true, data: { tempPassword: tempPassword }, error: '' };
}

function toggleUserActive(params, username) {
  var userId = params.userId || params.UserID;
  var isActive = params.isActive || params.IsActive;
  if (!userId) return { success: false, data: {}, error: 'UserID required' };

  var sheet = getSheet('USERS');
  var row = findRowByColumn(sheet, 0, userId);
  if (row === -1) return { success: false, data: {}, error: 'User not found' };

  var newVal = String(isActive).toUpperCase() === 'TRUE' || isActive === true ? 'TRUE' : 'FALSE';
  sheet.getRange(row, 8).setValue(newVal);
  auditLog(username, 'TOGGLE_USER', 'Set ' + userId + ' active=' + newVal);
  return { success: true, data: { userId: userId, isActive: newVal }, error: '' };
}

function generateTempPassword() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
  var pass = '';
  for (var i = 0; i < 12; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

// ─── PAYMENTS ───────────────────────────────────────────────────────────────

function recordPayment(params, username) {
  var memberId = params.memberId || params.MemberID;
  if (!memberId) return { success: false, data: {}, error: 'MemberID required' };

  var member = getMemberObject(memberId);
  if (!member) return { success: false, data: {}, error: 'Member not found' };
  if (member.Status !== 'Active') {
    return { success: false, data: {}, error: 'Member must be Active to record payment' };
  }
  if (member.Status === 'Exempt' || (member.ExemptionReason && member.ExemptionReason !== 'none')) {
    return { success: false, data: {}, error: 'Exempt members cannot have payments recorded' };
  }

  var channel = params.paymentChannel || params.PaymentChannel || 'Cash';
  if (channel === 'MoMo' && !(params.momoReference || params.MoMoReference)) {
    return { success: false, data: {}, error: 'MoMo reference required for MoMo payments' };
  }

  var sheet = getSheet('PAYMENTS');
  var paymentId = generatePaymentId(sheet);
  var month = normalizeMonthLabel(params.month || params.Month || getCurrentMonthLabel());
  var amountDue = parseFloat(params.amountDue || params.AmountDue || member.DuesAmount || 0);
  var amountPaid = parseFloat(params.amountPaid || params.AmountPaid || amountDue);
  var paymentDate = params.paymentDate || params.PaymentDate || new Date();
  var momoRef = channel === 'MoMo' ? (params.momoReference || params.MoMoReference || '') : '';

  sheet.appendRow([
    paymentId,
    String(memberId),
    member.FullName,
    month,
    amountDue,
    amountPaid,
    paymentDate,
    channel,
    momoRef,
    username,
    params.notes || params.Notes || ''
  ]);

  var lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 4).setNumberFormat('@').setValue(month);

  var payment = {
    PaymentID: paymentId,
    MemberID: String(memberId),
    MemberName: member.FullName,
    Month: month,
    AmountDue: amountDue,
    AmountPaid: amountPaid,
    PaymentDate: paymentDate,
    PaymentChannel: channel,
    MoMoReference: momoRef,
    RecordedBy: username,
    Notes: params.notes || params.Notes || ''
  };

  var receiptSent = false;
  if (member.Email) {
    try {
      sendPaymentReceiptEmail(member, payment, getConfigMap());
      receiptSent = true;
      auditLog(username, 'RECEIPT_SENT', 'Receipt emailed to ' + member.Email + ' for ' + paymentId);
    } catch (emailErr) {
      auditLog(username, 'RECEIPT_FAILED', paymentId + ': ' + String(emailErr.message || emailErr));
    }
  }

  auditLog(username, 'RECORD_PAYMENT', paymentId + ' for ' + memberId + ' - ' + month);
  return {
    success: true,
    data: { paymentId: paymentId, receiptSent: receiptSent },
    error: ''
  };
}

function normalizePaymentRecord(p) {
  return {
    PaymentID: p.PaymentID,
    MemberID: String(p.MemberID || ''),
    MemberName: p.MemberName,
    Month: normalizeMonthLabel(p.Month),
    AmountDue: p.AmountDue,
    AmountPaid: p.AmountPaid,
    PaymentDate: p.PaymentDate,
    PaymentChannel: p.PaymentChannel,
    MoMoReference: p.MoMoReference || '',
    RecordedBy: p.RecordedBy,
    Notes: p.Notes || ''
  };
}

function getPayments(params) {
  var payments = sheetToObjects(getSheet('PAYMENTS')).map(normalizePaymentRecord);

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
  var row = findRowByColumn(sheet, 0, paymentId);
  if (row === -1) return { success: false, data: {}, error: 'Payment not found' };

  sheet.deleteRow(row);
  auditLog(username, 'DELETE_PAYMENT', paymentId + ' - Reason: ' + reason);
  return { success: true, data: { paymentId: paymentId }, error: '' };
}

// ─── REPORTS ────────────────────────────────────────────────────────────────

function getEligibleMembers() {
  return sheetToObjects(getSheet('MEMBERS')).filter(function (m) {
    return m.Status === 'Active';
  });
}

function getPaidMemberIdsForMonth(month) {
  var targetMonth = normalizeMonthLabel(month);
  var payments = sheetToObjects(getSheet('PAYMENTS'));
  var paid = {};
  payments.forEach(function (p) {
    if (monthsMatch(p.Month, targetMonth)) {
      paid[String(p.MemberID)] = true;
    }
  });
  return paid;
}

function getMonthlySummary(params) {
  var month = normalizeMonthLabel(params.month || params.Month || getCurrentMonthLabel());
  var eligible = getEligibleMembers();
  var paidIds = getPaidMemberIdsForMonth(month);

  var paidMembers = [];
  var unpaidMembers = [];
  var totalCollected = 0;
  var totalExpected = 0;

  eligible.forEach(function (m) {
    var dues = parseFloat(m.DuesAmount) || 0;
    totalExpected += dues;
    if (paidIds[String(m.MemberID)]) {
      paidMembers.push(m);
      var payments = sheetToObjects(getSheet('PAYMENTS')).filter(function (p) {
        return String(p.MemberID) === String(m.MemberID) && monthsMatch(p.Month, month);
      });
      payments.forEach(function (p) {
        totalCollected += parseFloat(p.AmountPaid) || 0;
      });
    } else {
      unpaidMembers.push(m);
    }
  });

  return {
    success: true,
    data: {
      month: month,
      eligibleCount: eligible.length,
      paidCount: paidMembers.length,
      unpaidCount: unpaidMembers.length,
      totalCollected: totalCollected,
      totalOutstanding: totalExpected - totalCollected,
      totalExpected: totalExpected,
      paidMembers: paidMembers,
      unpaidMembers: unpaidMembers
    },
    error: ''
  };
}

function getMemberHistory(params, sessionMemberId, role) {
  var memberId = params.memberId || params.MemberID || sessionMemberId;
  var member = getMemberObject(memberId);
  if (!member) return { success: false, data: {}, error: 'Member not found' };

  var payments = sheetToObjects(getSheet('PAYMENTS')).filter(function (p) {
    return String(p.MemberID) === String(memberId);
  }).map(normalizePaymentRecord);

  payments.sort(function (a, b) {
    return new Date(b.PaymentDate) - new Date(a.PaymentDate);
  });

  var monthsPaid = payments.length;
  var totalPaid = 0;
  payments.forEach(function (p) {
    totalPaid += parseFloat(p.AmountPaid) || 0;
  });

  var year = new Date().getFullYear();
  var monthsInYear = new Date().getMonth() + 1;
  var monthsMissed = Math.max(0, monthsInYear - monthsPaid);
  var compliance = monthsInYear > 0 ? Math.round((monthsPaid / monthsInYear) * 100) : 0;

  return {
    success: true,
    data: {
      member: member,
      payments: payments,
      totalPaid: totalPaid,
      monthsPaid: monthsPaid,
      monthsMissed: monthsMissed,
      compliance: compliance
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
  var overdue = summary.data.unpaidMembers.map(function (m) {
    return {
      MemberID: m.MemberID,
      FullName: m.FullName,
      Email: m.Email,
      Phone: m.Phone,
      AmountOverdue: parseFloat(m.DuesAmount) || 0,
      MonthsOverdue: 1
    };
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
  var allPayments = sheetToObjects(getSheet('PAYMENTS'));
  var monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  var now = new Date();
  var maxMonth = year < now.getFullYear() ? 12 : now.getMonth() + 1;

  var memberSummaries = [];
  var totalCollected = 0;
  var totalExpected = 0;

  members.forEach(function (m) {
    var monthsPaid = 0;
    var totalPaid = 0;
    var paidMonths = {};

    allPayments.forEach(function (p) {
      if (String(p.MemberID) !== String(m.MemberID)) return;
      var md = parseMonthLabel(normalizeMonthLabel(p.Month));
      if (md && md.getFullYear() === year) {
        paidMonths[md.getMonth()] = true;
        totalPaid += parseFloat(p.AmountPaid) || 0;
      }
    });

    for (var i = 0; i < maxMonth; i++) {
      if (paidMonths[i]) monthsPaid++;
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

function getDashboardData(params, sessionMemberId, role) {
  var month = getCurrentMonthLabel();
  var config = getConfigMap();
  var result = {
    month: month,
    year: new Date().getFullYear(),
    familyName: config.FamilyName || 'Family Dues'
  };

  if (role === 'Admin' || role === 'Treasurer') {
    var summary = getMonthlySummary({ month: month });
    result.summary = summary.data;

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

  if (role === 'Member' && sessionMemberId) {
    var member = getMemberObject(sessionMemberId);
    var paidIds = getPaidMemberIdsForMonth(month);
    var isPaid = paidIds[sessionMemberId] || false;
    result.memberDues = {
      amount: member ? parseFloat(member.DuesAmount) || 0 : 0,
      status: member && member.Status === 'Exempt' ? 'EXEMPT' : (isPaid ? 'PAID' : 'UNPAID'),
      memberName: member ? member.FullName : ''
    };

    var history = getMemberHistory({ memberId: sessionMemberId }, sessionMemberId, role);
    result.paymentHistory = (history.data.payments || []).slice(0, 12);
  }

  if ((role === 'Admin' || role === 'Treasurer') && sessionMemberId) {
    var adminMember = getMemberObject(sessionMemberId);
    if (adminMember) {
      var adminPaid = getPaidMemberIdsForMonth(month);
      result.memberDues = {
        amount: parseFloat(adminMember.DuesAmount) || 0,
        status: adminMember.Status === 'Exempt' ? 'EXEMPT' : (adminPaid[sessionMemberId] ? 'PAID' : 'UNPAID')
      };
    }
  }

  return { success: true, data: result, error: '' };
}

// ─── REMINDERS ──────────────────────────────────────────────────────────────

function sendReminders(params, username) {
  var config = getConfigMap();
  var reminderDays = parseInt(config.ReminderDaysBefore, 10) || 5;
  var deadlineDay = parseInt(config.DeadlineDay, 10) || 31;
  var now = new Date();
  var month = getCurrentMonthLabel();
  var lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  var daysUntilEnd = lastDay - now.getDate();

  var summary = getMonthlySummary({ month: month });
  var sent = 0;

  if (daysUntilEnd === reminderDays) {
    summary.data.unpaidMembers.forEach(function (m) {
      if (m.Email) {
        sendMonthlyReminderEmail(m, month, deadlineDay, config);
        sent++;
        auditLog(username || 'system', 'REMINDER_SENT', 'Monthly reminder to ' + m.Email);
      }
    });
  }

  if (now.getDate() === 1 || (now.getDate() === deadlineDay + 1 && deadlineDay < lastDay)) {
    var overdue = summary.data.unpaidMembers;
    overdue.forEach(function (m) {
      if (m.Email) {
        sendOverdueNoticeEmail(m, month, config);
        sent++;
        auditLog(username || 'system', 'OVERDUE_NOTICE', 'Overdue notice to ' + m.Email);
      }
    });

    if (overdue.length > 0) {
      sendTreasurerAlertEmail(overdue, month, config);
      auditLog(username || 'system', 'TREASURER_ALERT', 'Sent overdue alert for ' + month);
    }
  }

  return { success: true, data: { remindersSent: sent, month: month }, error: '' };
}

function sendReminderToMember(params, username) {
  var memberId = params.memberId || params.MemberID;
  var month = params.month || params.Month || getCurrentMonthLabel();
  var member = getMemberObject(memberId);
  if (!member) return { success: false, data: {}, error: 'Member not found' };
  if (!member.Email) return { success: false, data: {}, error: 'Member has no email' };

  var config = getConfigMap();
  var deadlineDay = parseInt(config.DeadlineDay, 10) || 31;
  sendMonthlyReminderEmail(member, month, deadlineDay, config);
  auditLog(username, 'REMINDER_SENT', 'Manual reminder to ' + member.Email);
  return { success: true, data: { memberId: memberId }, error: '' };
}

// ─── Email Templates (Phase 9) ──────────────────────────────────────────────

function emailWrapper(familyName, bodyContent) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f5f5f5;font-family:Inter,Arial,sans-serif;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:20px auto;background:#ffffff;border-radius:8px;overflow:hidden;">' +
    '<tr><td style="background:#1B5E20;padding:24px 32px;text-align:center;">' +
    '<h1 style="margin:0;color:#FFC107;font-size:22px;font-weight:700;">' + familyName + '</h1>' +
    '<p style="margin:8px 0 0;color:#ffffff;font-size:14px;">Family Dues Management</p></td></tr>' +
    '<tr><td style="padding:32px;color:#333333;font-size:15px;line-height:1.6;">' + bodyContent + '</td></tr>' +
    '<tr><td style="background:#f0f0f0;padding:16px 32px;text-align:center;color:#666666;font-size:12px;">Powered by Family Dues System</td></tr>' +
    '</table></body></html>';
}

function sendMonthlyReminderEmail(member, month, deadlineDay, config) {
  var familyName = config.FamilyName || 'Family';
  var amount = parseFloat(member.DuesAmount) || 0;
  var body = emailWrapper(familyName,
    '<p>Dear ' + member.FullName + ',</p>' +
    '<p>Your monthly dues of <strong>GHS ' + amount.toFixed(2) + '</strong> for <strong>' + month + '</strong> are due by the <strong>' + deadlineDay + '</strong> of the month.</p>' +
    '<p>Payment channels: MoMo (<strong>' + (config.MoMoNumber || '') + '</strong>) or Cash to the Treasurer.</p>' +
    '<p>Contact <a href="mailto:' + (config.TreasurerEmail || config.SystemEmail) + '">' + (config.TreasurerEmail || config.SystemEmail) + '</a> for help.</p>'
  );
  GmailApp.sendEmail(member.Email, familyName + ' Dues Reminder — ' + month, '', {
    htmlBody: body,
    name: familyName + ' Dues'
  });
}

function sendOverdueNoticeEmail(member, month, config) {
  var familyName = config.FamilyName || 'Family';
  var amount = parseFloat(member.DuesAmount) || 0;
  var body = emailWrapper(familyName,
    '<p>Dear ' + member.FullName + ',</p>' +
    '<p>Your dues of <strong>GHS ' + amount.toFixed(2) + '</strong> for <strong>' + month + '</strong> are now <strong style="color:#c62828;">overdue</strong>.</p>' +
    '<p>Please pay immediately. Contact the treasurer at <a href="mailto:' + (config.TreasurerEmail || config.SystemEmail) + '">' + (config.TreasurerEmail || config.SystemEmail) + '</a>.</p>'
  );
  GmailApp.sendEmail(member.Email, familyName + ' Dues OVERDUE — ' + month, '', {
    htmlBody: body,
    name: familyName + ' Dues'
  });
}

function sendTreasurerAlertEmail(overdueMembers, month, config) {
  var familyName = config.FamilyName || 'Family';
  var rows = overdueMembers.map(function (m) {
    return '<tr><td style="padding:8px;border-bottom:1px solid #eee;">' + m.FullName + '</td>' +
      '<td style="padding:8px;border-bottom:1px solid #eee;">' + (m.Email || '') + '</td>' +
      '<td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">GHS ' + (parseFloat(m.DuesAmount) || 0).toFixed(2) + '</td></tr>';
  }).join('');

  var body = emailWrapper(familyName,
    '<p>The following members have overdue dues for <strong>' + month + '</strong>:</p>' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">' +
    '<tr style="background:#1B5E20;color:#ffffff;">' +
    '<th style="padding:10px;text-align:left;">Name</th>' +
    '<th style="padding:10px;text-align:left;">Email</th>' +
    '<th style="padding:10px;text-align:right;">Amount</th></tr>' + rows + '</table>'
  );

  var recipients = [];
  if (config.TreasurerEmail) recipients.push(config.TreasurerEmail);
  if (config.SystemEmail) recipients.push(config.SystemEmail);

  var users = sheetToObjects(getSheet('USERS'));
  users.forEach(function (u) {
    if (u.Role === 'Admin' || u.Role === 'Treasurer') {
      var m = u.MemberID ? getMemberObject(u.MemberID) : null;
      if (m && m.Email && recipients.indexOf(m.Email) === -1) recipients.push(m.Email);
    }
  });

  if (recipients.length === 0 && config.SystemEmail) recipients.push(config.SystemEmail);

  recipients.forEach(function (email) {
    GmailApp.sendEmail(email, familyName + ' Overdue Dues Alert — ' + month, '', {
      htmlBody: body,
      name: familyName + ' Dues'
    });
  });
}

function sendWelcomeEmail(name, email, username, tempPassword) {
  var config = getConfigMap();
  var familyName = config.FamilyName || 'Family';
  var loginUrl = config.LoginUrl || '';
  var body = emailWrapper(familyName,
    '<p>Dear ' + name + ',</p>' +
    '<p>Your account for the ' + familyName + ' Dues Portal has been created.</p>' +
    '<table style="margin:16px 0;background:#f9f9f9;padding:16px;border-radius:6px;width:100%;">' +
    '<tr><td style="padding:4px 0;"><strong>Username:</strong></td><td>' + username + '</td></tr>' +
    '<tr><td style="padding:4px 0;"><strong>Temporary Password:</strong></td><td>' + tempPassword + '</td></tr>' +
    '<tr><td style="padding:4px 0;"><strong>Login URL:</strong></td><td><a href="' + loginUrl + '">' + loginUrl + '</a></td></tr>' +
    '</table>' +
    '<p>Please log in and change your password after your first login.</p>'
  );
  GmailApp.sendEmail(email, 'Your ' + familyName + ' Dues Portal Account', '', {
    htmlBody: body,
    name: familyName + ' Dues'
  });
}

function sendPaymentReceiptEmail(member, payment, config) {
  var familyName = config.FamilyName || 'Family';
  var monthLabel = normalizeMonthLabel(payment.Month);
  var amountDue = parseFloat(payment.AmountDue) || 0;
  var amountPaid = parseFloat(payment.AmountPaid) || 0;
  var receiptRows = [
    ['Receipt No.', payment.PaymentID],
    ['Member', member.FullName],
    ['Month', monthLabel],
    ['Amount Due', 'GHS ' + amountDue.toFixed(2)],
    ['Amount Paid', 'GHS ' + amountPaid.toFixed(2)],
    ['Payment Channel', payment.PaymentChannel],
    ['Payment Date', formatDateDisplay(payment.PaymentDate)],
    ['Recorded By', payment.RecordedBy]
  ];

  if (payment.PaymentChannel === 'MoMo' && payment.MoMoReference) {
    receiptRows.push(['MoMo Reference', payment.MoMoReference]);
  }
  if (payment.Notes) {
    receiptRows.push(['Notes', payment.Notes]);
  }

  var tableHtml = receiptRows.map(function (row) {
    return '<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">' + row[0] +
      '</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;">' + row[1] + '</td></tr>';
  }).join('');

  var body = emailWrapper(familyName,
    '<p>Dear ' + member.FullName + ',</p>' +
    '<p>Thank you. Your dues payment has been received and recorded successfully.</p>' +
    '<table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f9f9f9;border-radius:6px;">' +
    tableHtml + '</table>' +
    '<p>Please keep this email as your official payment receipt.</p>'
  );

  GmailApp.sendEmail(
    member.Email,
    'Payment Receipt — ' + familyName + ' (' + monthLabel + ')',
    '',
    { htmlBody: body, name: familyName + ' Dues' }
  );
}

function sendPasswordResetEmail(name, email, username, tempPassword) {
  var config = getConfigMap();
  var familyName = config.FamilyName || 'Family';
  var loginUrl = config.LoginUrl || '';
  var body = emailWrapper(familyName,
    '<p>Dear ' + name + ',</p>' +
    '<p>Your password has been reset.</p>' +
    '<table style="margin:16px 0;background:#f9f9f9;padding:16px;border-radius:6px;width:100%;">' +
    '<tr><td style="padding:4px 0;"><strong>Username:</strong></td><td>' + username + '</td></tr>' +
    '<tr><td style="padding:4px 0;"><strong>New Temporary Password:</strong></td><td>' + tempPassword + '</td></tr>' +
    '<tr><td style="padding:4px 0;"><strong>Login URL:</strong></td><td><a href="' + loginUrl + '">' + loginUrl + '</a></td></tr>' +
    '</table>' +
    '<p>Please log in and change your password immediately.</p>'
  );
  GmailApp.sendEmail(email, 'Password Reset — ' + familyName + ' Dues Portal', '', {
    htmlBody: body,
    name: familyName + ' Dues'
  });
}

// ─── Triggers ───────────────────────────────────────────────────────────────

function setupDailyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (t) {
    if (t.getHandlerFunction() === 'sendRemindersDaily') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('sendRemindersDaily')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();
}

function sendRemindersDaily() {
  sendReminders({}, 'system');
}

// ─── Date Helpers ───────────────────────────────────────────────────────────

function getCurrentMonthLabel() {
  return formatMonthLabel(new Date());
}

function formatMonthLabel(date) {
  var months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return months[date.getMonth()] + ' ' + date.getFullYear();
}

function parseMonthLabel(label) {
  if (!label) return null;
  var months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var parts = String(label).trim().split(/\s+/);
  if (parts.length < 2) return null;
  var idx = months.indexOf(parts[0]);
  if (idx === -1) return null;
  return new Date(parseInt(parts[1], 10), idx, 1);
}

function normalizeMonthLabel(value) {
  if (value === null || value === undefined || value === '') return '';

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return formatMonthLabel(value);
  }

  var str = String(value).trim();
  var parsed = parseMonthLabel(str);
  if (parsed) return formatMonthLabel(parsed);

  var asDate = new Date(str);
  if (!isNaN(asDate.getTime())) return formatMonthLabel(asDate);

  return str;
}

function monthsMatch(a, b) {
  return normalizeMonthLabel(a) === normalizeMonthLabel(b);
}

function formatDateDisplay(dateVal) {
  var d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal || '');
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd MMM yyyy');
}

function formatDateISO(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/**
 * One-time fix: normalizes Month column text for all existing payment rows.
 * Run from Apps Script editor if older payments are missing from reports.
 */
function fixPaymentMonthFormats() {
  var sheet = getSheet('PAYMENTS');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 'No payments to fix';

  var data = sheet.getRange(2, 1, lastRow, sheet.getLastColumn()).getValues();
  var fixed = 0;

  for (var i = 0; i < data.length; i++) {
    var normalized = normalizeMonthLabel(data[i][3]);
    if (normalized && normalized !== String(data[i][3])) {
      var rowNum = i + 2;
      sheet.getRange(rowNum, 4).setNumberFormat('@').setValue(normalized);
      fixed++;
    } else if (normalized) {
      sheet.getRange(i + 2, 4).setNumberFormat('@');
    }
  }

  return 'Fixed ' + fixed + ' payment month value(s)';
}
