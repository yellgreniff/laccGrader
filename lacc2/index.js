var express = require('express');
var bodyParser = require('body-parser');
var logger = require('morgan');
var exphbs = require('express-handlebars');
var _ = require('lodash');
var dotenv = require('dotenv');
var mongoose = require('mongoose');
var request = require('request');
var Spamcall = require('./models/Spamcall');

var app = express();


dotenv.load();

// Connect to MongoDB
console.log(process.env.MONGODB)
mongoose.connect(process.env.MONGODB);
mongoose.connection.on('error', function() {
    console.log('MongoDB Connection Error. Please make sure that MongoDB is running.');
    process.exit(1);
});

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.engine('handlebars', exphbs({ defaultLayout: 'main' }));
app.set('view engine', 'handlebars');
app.use('/public', express.static('public'));

var phonenum_regex = /^\d{10}$/;
var areacode_regex = /^\d{3}$/;

/* Add whatever endpoints you need! Remember that your API endpoints must
 * have '/api' prepended to them. Please remember that you need at least 5 
 * endpoints for the API, and 5 others. 
 */

/* Api Endpoints:
• /api/number/:number - get
• /api/report_num - post
• /api/areacode/:areacode - get
• /api/spam - get 
• /api/telemarketers - get 
• /api/robocallers - get 
• /api/mostreported - get

Other Endpoints:
• / (allnums.handlebars)
• /number/:number
• /report_num
• /areacode/:areacode
• /spam
• /telemarketers
• /robocallers
• /mostreported

don't need partials since links will be hardcoded
*/

// API endpoints begin here
app.get('/api/number/:number', function(req,res){
	var number = req.params.number;
	if (!phonenum_regex.test(number)) {
		return res.json({"Invalid phone number.":"Phone numbers must be exactly 10 digits"});
	}
	Spamcall.findOne({phonenum: number}, function(err,spamcall){
		if (err) throw err;

		if (!spamcall) {
			res.json({"This number has not been reported yet.":number});
		} else {
			res.json(spamcall);
		}
	});
});

app.post('/api/report_num', function(req,res){
	var phonenum = req.body.phonenum;
	if (!phonenum_regex.test(phonenum)) {
		return res.json({"Invalid phone number.":"Phone numbers must be exactly 10 digits"});
	}
	var reports = req.body.reports;
	if (!(parseInt(reports) > 0)) {
		return res.json({"Invalid number of reports.":"Reports must be positive digits"});
	}
	reports = parseInt(reports);
	var calltype = req.body.calltype;
	var callcontent = req.body.callcontent;
	var howtounsub = req.body.howtounsub;

	Spamcall.findOne({phonenum: phonenum}, function(err,spamcall){
		if (err) throw err;

		if (!spamcall) { //new number not in db yet
			var newspam = new Spamcall({
				phonenum: phonenum,
				calltype: [calltype],
				callcontent: [callcontent],
				reports: reports,
				howtounsub: [howtounsub]
			});
			newspam.save(function(err){
				if (err) throw err;
				console.log("New number: " + phonenum + " saved successfully");
			});
		} else { //old number - just updated it
			spamcall.calltype.push(calltype);
			spamcall.callcontent.push(callcontent);
			spamcall.reports += reports;
			spamcall.howtounsub.push(howtounsub);

			spamcall.save(function(err){
				if (err) throw err;
				console.log("Added new report of old number: " + phonenum);
			});
		}
	});
	res.json({"Reported Successfully":phonenum});
});

app.get('/api/areacode/:areacode', function(req,res){
	var areacode = req.params.areacode;
	if (!areacode_regex.test(areacode)) {
		return res.json({"Invalid areacode":"Area codes must be exactly 3 digits"})
	}
	Spamcall.find({phonenum: new RegExp(areacode+'[0-9]{7}')},function(err, spamcalls){
		if (err) throw err;

		if (spamcalls.length == 0) {
			res.json({"No numbers reported with area code":areacode});
		} else {
			res.json(spamcalls);
		}
	});
});

app.get('/api/spam', function(req,res){
	Spamcall.find({calltype: "Spam"}, function(err, spamcalls) {
		if (err) throw err;

		if (spamcalls.length == 0) {
			res.json({"No spam numbers reported":"No spam callers yet"});
		} else {
			res.json(spamcalls);
		}
	});
});

app.get('/api/telemarketers', function(req,res){
	Spamcall.find({calltype: "Telemarketers"}, function(err, spamcalls) {
		if (err) throw err;

		if (spamcalls.length == 0) {
			res.json({"No telemarketers reported":"No telemarketers yet"});
		} else {
			res.json(spamcalls);
		}
	});
});

app.get('/api/robocallers', function(req,res){
	Spamcall.find({calltype: "Robocallers"}, function(err, spamcalls) {
		if (err) throw err;

		if (spamcalls.length == 0) {
			res.json({"No robocallers reported":"No robocallers yet"});
		} else {
			res.json(spamcalls);
		}
	});
});

app.get('/api/mostreported', function(req,res){
	Spamcall.find({}).sort({reports: 'desc'}).find().exec(function(err,spamcalls){
		if (err) throw err;

		var mostreports = spamcalls[0].reports;
		var mostreportednums = [];

		spamcalls.forEach(function(call){
			if (call.reports == mostreports) {
				mostreportednums.push(call);
			}
		});

		if (spamcalls.length == 0) {
			res.json({"No reports have been submitted":"Check back later"});
		} else {
			res.json(mostreportednums);
		}
	});
});

app.get('/api/get_all_reports', function(req,res){
	Spamcall.find({},function(err,allreports){
		if (err) throw err;

		res.json(allreports);
	});
});

// Other endpoints begin here
app.get('/', function(req,res){

	Spamcall.find({}, function(err,spamcalls){
		if (err) throw err;
		var numsonly = [];
		spamcalls.forEach(function(call){
			numsonly.push(call.phonenum);
		});
		res.render('allnums',{
			search: JSON.stringify(numsonly),
			numbers: spamcalls
		});
	});
});

app.get('/number/:number', function(req,res){
	var number = req.params.number;
	if (!phonenum_regex.test(number)) {
		return res.render('number',{
			validnum: false,
			found: false,
			givennum: number,
			num: {}
		});
	}
	Spamcall.findOne({phonenum: number}, function(err,spamcall){
		if (err) throw err;

		if (!spamcall) {
			res.render('number',{
				validnum: true,
				found: false,
				givennum: number,
				num: {}
			});
		} else {
			res.render('number',{
				validnum: true,
				found: true,
				givennum: number,
				num: spamcall
			});
		}
	});
});

app.get('/report_num', function(req,res){
	res.render('reportnum');
});

app.post('/report_num', function(req,res){
	var body = req.body;
	console.log("Phone number: " + body.phonenum);
	console.log("Call type: " + body.calltype);
	console.log("Call content: " + body.callcontent);
	body.reports = parseInt(body.reports);
	console.log("Reports: "+ body.reports);
	console.log("How to unsub: " + body.howtounsub);
	var options = { 
	    method: 'POST',
	    url: 'http://localhost:3000/api/report_num',
	    headers: { 
	        'content-type': 'application/x-www-form-urlencoded' 
	    },
	    form: { 
	       phonenum: body.phonenum,
	       calltype: body.calltype,
	       callcontent: body.callcontent,
	       reports: body.reports,
	       howtounsub: body.howtounsub
	    } 
	};
	request(options, function (error, response, body) {
	  if (error) throw new Error(error);
	  console.log(body);
	  res.redirect('/');
	});
});

app.get('/areacode/:areacode', function(req,res){
	var areacode = req.params.areacode;
	console.log("Area code:" + areacode);

	if (!areacode_regex.test(areacode)) {
		return res.render('areacode', {
			areacodevalid: false,
			areacode: areacode,
			phonenums: {}
		});
	}
	Spamcall.find({phonenum: new RegExp(areacode+'[0-9]{7}')},function(err, spamcalls){
		if (err) throw err;

		if (spamcalls.length == 0) {
			res.render('areacode', {
				areacodevalid: true,
				areacode: areacode,
				phonenums: undefined
			});
		} else {
			var areanums = [];
			spamcalls.forEach(function(call){
				areanums.push(call.phonenum);
			});
			res.render('areacode', {
				areacodevalid: true,
				areacode: areacode,
				phonenums: areanums
			});
		}
	});
});

app.get('/spam', function(req,res){
	Spamcall.find({calltype: "Spam"}, function(err, spamcalls) {
		if (err) throw err;

		if (spamcalls.length == 0) {
			res.render('spam',{
				spam: undefined
			});
		} else {
			res.render('spam',{
				spam: spamcalls
			});
		}
	});
});

app.get('/telemarketers', function(req,res){
	Spamcall.find({calltype: "Telemarketers"}, function(err, spamcalls) {
		if (err) throw err;

		if (spamcalls.length == 0) {
			res.render('telemarketers',{
				telemarketers: undefined
			});
		} else {
			res.render('telemarketers',{
				telemarketers: spamcalls
			});
		}
	});
});

app.get('/robocallers', function(req,res){
	Spamcall.find({calltype: "Robocallers"}, function(err, spamcalls) {
		if (err) throw err;

		if (spamcalls.length == 0) {
			res.render('robocallers',{
				robocallers: undefined
			});
		} else {
			res.render('robocallers',{
				robocallers: spamcalls
			});
		}
	});
});

app.get('/mostreported', function(req,res){
	Spamcall.find({}).sort({reports: 'desc'}).find().exec(function(err,spamcalls){
		if (err) throw err;

		var mostreports = spamcalls[0].reports;
		var mostreportednums = [];

		spamcalls.forEach(function(call){
			if (call.reports == mostreports) {
				mostreportednums.push(call);
			}
		});

		if (spamcalls.length == 0) {
			res.render('mostreported',{
				mostreported: undefined
			});
		} else {
			res.render('mostreported',{
				mostreported: mostreportednums
			});
		}
	});
});

app.listen(3000, function() {
    console.log('Spam Caller DB listening on port 3000!');
});