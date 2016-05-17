var express = require("express");
var request = require("request");
const low = require("lowdb")
const storage = require("lowdb/file-sync");

const db = low("db.json", { storage: storage })

var app = express();
var server = require("http").Server(app);
var io = require("socket.io")(server);

var sockets = [];

app.set("view engine", "ejs");
app.use(require("body-parser")());

app.get("/", function(req, res) {
	res.render("index");
});

app.post("/create", function(req, res) {
	var id = db("polls").size() + 1;
	db("polls").push({
		"id": id,
		"title": req.body.title,
		"options": req.body.options,
		"votes": {}
	});
	res.redirect("/p/" + id + "/r");
});

app.get("/p/:id", function(req, res) {
	var id = parseInt(req.params.id);
	var data = db("polls").find({ id: id });
	res.render("vote", {
		id: id,
		title: data.title,
		options: data.options
	});
});

request("https://connection.naviance.com/family-connection/auth/login?hsid=aeshs", function(err, response, body) {
	var cookies = response.headers["set-cookie"], sess;
	for(var i=0; i<cookies.length; i++) {
		if (cookies[i].split("=")[0]== "sess") {
			sess = cookies[i].split(";")[0].split("=")[1];
		}
	}
	app.post("/p/:id/vote", function(req, res) {
		var id = parseInt(req.params.id);
		if (!(req.body.choice && parseInt(req.body.choice) >= 0)) {
			return res.redirect("/p/" + id + "/?error=Please make a choice.");
		}
		request.post({ url: "https://connection.naviance.com/family-connection/auth/login/authenticate", headers: {
			"Cookie": "sess=" + sess + ";"
		}, form: {
			"username": req.body.user + "@students.d125.org",
			"password": req.body.pass,
			"is_ajax": true
		}}, function(err, response, body) {
			var data = JSON.parse(body);
			if (data.url == "auth/platform/check") {
				var obj = db("polls").find({ id: id });
				if (!(obj != undefined && "title" in obj))
					return res.redirect("/p/" + id + "/?error=Invalid ID.");
				if (req.body.user.toLowerCase() in obj.votes)
					return res.redirect("/p/" + id + "/?error=Already voted.");
				var new_votes = obj.votes;
				new_votes[req.body.user.toLowerCase()] = parseInt(req.body.choice);
				db("polls").chain()
					.find({ id: id })
					.assign({ votes: new_votes }).value();
				io.emit("poll" + id, obj.options[parseInt(req.body.choice)]);
				res.redirect("/p/" + id + "/r");
			} else {
				return res.redirect("/p/" + id + "/?error=Invalid Login");
			}
		});
	});
});

app.get("/p/:id/r", function(req, res) {
	var id = parseInt(req.params.id);
	res.render("results", get_data(id));
});

var get_data = function(id) {
	var data = db("polls").find({ id: id });
	var votes = [], options = [];
	for(var i=0; i<data.options.length; i++) votes.push(0);
	for(var person in data.votes) {
		votes[data.votes[person]] += 1;
	}
	for(var i=0; i<data.options.length; i++) {
		options.push({
			"option": data.options[i],
			"votes": votes[i]
		});
	}
	options.sort(function(a, b) {
		return b["votes"] - a["votes"];
	})
	return {
		id: id,
		title: data.title,
		options: options
	};
}

io.on("connection", function(socket) {
});

server.listen(8080, function() {
	console.log("Listening.");
});