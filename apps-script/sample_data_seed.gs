/**
 * Sample data seeder for Family Dues Management System
 * Run seedSampleData() once from the Apps Script editor after setupDatabase()
 */

function seedSampleData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet() || getSpreadsheetByName();
  if (!ss) throw new Error('Open FamilyDuesDB spreadsheet first');

  var membersSheet = ss.getSheetByName('MEMBERS');
  var paymentsSheet = ss.getSheetByName('PAYMENTS');
  var now = new Date();

  var sampleMembers = [
    ['Kwame Asante', 'kwame.asante@email.com', '0241110001', '1985-03-15', 'Active', 'none', 50],
    ['Ama Mensah', 'ama.mensah@email.com', '0241110002', '1990-07-22', 'Active', 'none', 50],
    ['Kofi Boateng', 'kofi.boateng@email.com', '0241110003', '1978-11-08', 'Active', 'none', 75],
    ['Abena Osei', 'abena.osei@email.com', '0241110004', '1995-01-30', 'Active', 'none', 50],
    ['Yaw Darko', 'yaw.darko@email.com', '0241110005', '1982-09-12', 'Active', 'none', 60],
    ['Akua Frimpong', 'akua.frimpong@email.com', '0241110006', '2008-04-05', 'Exempt', 'Under18', 0],
    ['Nana Adjei', 'nana.adjei@email.com', '0241110007', '1955-12-20', 'Exempt', 'Elderly', 0],
    ['Efua Ampofo', 'efua.ampofo@email.com', '0241110008', '1988-06-18', 'Active', 'none', 50],
    ['Kwesi Owusu', 'kwesi.owusu@email.com', '0241110009', '1992-02-28', 'Inactive', 'none', 50],
    ['Maame Sarpong', 'maame.sarpong@email.com', '0241110010', '1980-08-14', 'Active', 'none', 55]
  ];

  var startId = membersSheet.getLastRow();
  sampleMembers.forEach(function (m, idx) {
    var memberId = 'FM' + ('000' + (startId + idx)).slice(-3);
    membersSheet.appendRow([
      memberId, m[0], m[1], m[2], m[3], m[4], m[5], m[6], now, 'admin', ''
    ]);
  });

  var allMembers = membersSheet.getDataRange().getValues();
  var activeMembers = [];
  for (var i = 1; i < allMembers.length; i++) {
    if (allMembers[i][5] === 'Active') {
      activeMembers.push({ id: allMembers[i][0], name: allMembers[i][1], dues: allMembers[i][7] });
    }
  }

  var months = getRecentMonths(3);
  var payCounter = 1;
  var year = new Date().getFullYear();

  months.forEach(function (month, monthIdx) {
    activeMembers.forEach(function (member, memberIdx) {
      if (monthIdx === 0 && memberIdx >= 7) return;
      if (monthIdx === 1 && memberIdx >= 5) return;

      var paymentId = 'PAY-' + year + '-' + ('000' + payCounter).slice(-3);
      payCounter++;
      var channel = memberIdx % 2 === 0 ? 'MoMo' : 'Cash';
      var momoRef = channel === 'MoMo' ? 'MM' + year + payCounter : '';

      paymentsSheet.appendRow([
        paymentId,
        member.id,
        member.name,
        month,
        member.dues,
        member.dues,
        new Date(year, new Date().getMonth() - (2 - monthIdx), 10 + memberIdx),
        channel,
        momoRef,
        'admin',
        'Sample payment'
      ]);
    });
  });

  Logger.log('Sample data seeded: ' + sampleMembers.length + ' members, payments for ' + months.join(', '));
  return 'Sample data seeded successfully';
}

function getRecentMonths(count) {
  var months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  var result = [];
  var now = new Date();
  for (var i = count - 1; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push(months[d.getMonth()] + ' ' + d.getFullYear());
  }
  return result;
}

function getSpreadsheetByName() {
  var files = DriveApp.getFilesByName('FamilyDuesDB');
  if (files.hasNext()) return SpreadsheetApp.open(files.next());
  return null;
}
