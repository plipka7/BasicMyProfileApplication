var express = require("express"),
	app = express(),
	mongoose = require("mongoose"),
	passport = require("passport"),
	bodyParser = require("body-parser"),
	LocalStrategy = require("passport-local"),
	passportLocalMongoose = require("passport-local-mongoose");
	expressSession = require("express-session"),
	user = require("./models/User"),
	request = require("request"),
	searchTerm = null,
	imageUrl = null;

	/*Serve the files in the public directory*/
	app.use(express.static(__dirname + "/public"));

	/*Connect to MongoDB*/
	mongoose.connect("mongodb://localhost/MyProfileApp", {useNewUrlParser: true});

	/*Set default view files to ejs*/
	app.set("view engine", "ejs");

	/*Set-up the body parser*/
	app.use(bodyParser.urlencoded({extended: true}));

	/*Set-up express session*/
	app.use(expressSession({
		secret: "alskdfja;lskdfj",
		resave: false,
		saveUninitialized: false
	}));

	/*Set-up passport*/
	passport.use(new LocalStrategy(user.authenticate()));
	app.use(passport.initialize());
	app.use(passport.session());

	/*Setup serialize and deserialize methods for passport*/
	passport.serializeUser(user.serializeUser());
	passport.deserializeUser(user.deserializeUser());

	/*Setup Bing Search API*/
	const Search = require('azure-cognitiveservices-imagesearch');
	const CognitiveServicesCredentials = require('ms-rest-azure').CognitiveServicesCredentials;
	let bingServiceKey = "e66fd0ced5d74012aac59c99b9846204";
	let credentials = new CognitiveServicesCredentials(bingServiceKey);
	var ImageSearchApiClient = new Search(credentials);

	/*Helper function for Bing search queries*/
	const sendQuery = async (searchTerm) => {
	    return await ImageSearchApiClient.imagesOperations.search(searchTerm);
	};

	/************ROUTES**********/
	/*Home page*/
	app.get("/", function(req, res) {
		res.render("login", {loggedIn: req.isAuthenticated()});
	});

	/*Login Failure Page*/
	app.get("/login/error", isLoggedIn, function(req, res) {
		res.render("loginError", {loggedIn: req.isAuthenticated()});
	});

	/*Registration Page*/
	app.get("/register", function(req, res) {
		res.render("register", {loggedIn: req.isAuthenticated()});
	});

	/*Profile Page*/
	app.get("/profile", isLoggedIn, function(req, res) {
		let userId = req.user.id;
		console.log("**********PROFILE***********\n" + req.user.profile.firstname);
		res.render("profile", {
			loggedIn: req.isAuthenticated(),
			profile: req.user.profile
		});
	});

	/*Search Page*/
	app.get("/search", isLoggedIn, function(req, res) {
		res.render("search", {loggedIn: req.isAuthenticated()});
	});

	/*Search Failure*/
	app.get("/search/failure", function(req, res) {
		res.send("Search Failure");
	});

	/*Search Success*/
	app.get("/search/success", isLoggedIn, function(req, res) {
		res.render("searchSuccess", {
			loggedIn: req.isAuthenticated(), 
			image: {name: searchTerm, link: imageUrl}
		});
	});

	/*Logout the user*/
	app.get("/logout", function(req, res) {
		req.logout();
		res.redirect("/");
	});

	/*Remove a picture*/
	app.get("/removePicture/:index", function(req, res) {
		if(!req.params.index) {
			res.redirect("/profile");
		}
		user.findById(req.user.id).exec().then(doc => {
			doc.profile.likes.splice(req.params.index, 1);
			doc.save();
			res.redirect("/profile");
		}).catch(err => {
			console.log(err);
			res.redirect("/profile");
		});
	});

	/*Handle Registration Request*/
	app.post("/register", function(req, res) {
		console.log("****Request Body****")
		console.log(req.body);
		user.register(new user({
							username: req.body.username,
							profile: {
								firstname: req.body.firstname,
								lastname: req.body.lastname,
								profilepicture: "https://image.flaticon.com/icons/png/512/21/21294.png"
							}	
						  }), req.body.password, 
		function(err, user) {
			if(err) {
				console.log("ERR\n" + err);
				return res.render("registerError", {loggedIn: req.isAuthenticated()});
			}
			passport.authenticate("local")(req, res, function() {
				res.redirect("/profile");
			});
		});
	});

	/*Handle Login Request*/
	app.post("/login", passport.authenticate("local", {
			successRedirect: "/profile",
			failureRedirect: "/login/error"}), 
			function(req, res) {
			}
	);

	/*Handle image request*/
	app.post("/search", isLoggedIn, function(req, res) {
		sendQuery(req.body.searchTerm).then(imageResults => {
			if (imageResults == null) {
				console.log("No image results were found.");
				return res.redirect("/search/failure")
			}
			else {
				console.log(`Total number of images returned: ${imageResults.value.length}`);
				let firstImageResult = imageResults.value[0];
		        //display the details for the first image result. After running the application,
		        //you can copy the resulting URLs from the console into your browser to view the image.
		        console.log(`Total number of images found: ${imageResults.value.length}`);
		        console.log(`Copy these URLs to view the first image returned:`);
		        console.log(`First image thumbnail url: ${firstImageResult.thumbnailUrl}`);
		        console.log(`First image content url: ${firstImageResult.contentUrl}`);
		        imageUrl = firstImageResult.contentUrl;
		        searchTerm = req.body.searchTerm;
				res.redirect("/search/success");
		    }
		}).catch(err => {
			console.error(err);
			return res.redirect("/search/failure");
		});
	});

	/*Add image to user's profile*/
	app.post("/search/success", isLoggedIn, function(req, res) {
		user.findById(req.user.id).exec().then( doc => {
			console.log("hereeeee")
			console.log(`IMAGELINK\n${imageUrl}`)
			doc.profile.likes.push({
				image: imageUrl, 
				name: searchTerm
			});
			doc.save();
			searchTerm = null;
			imageUrl = null;
			console.log("Successful save!!!! DOC: \n" + doc);
			res.redirect("/profile");
		}).catch(err => {
			console.log("QUERY ERROR\n");
			console.log(err);
			searchTerm = null;
			imageUrl = null;			
			return res.redirect("/profile");
		});
	});

	/*Change profile picture*/
	app.post("/changepp", function(req, res) {
		user.findById(req.user.id).exec().then( doc => {
			doc.profile.profilepicture = req.body.imageurl;
			doc.save();
			res.redirect("/profile");
		}).catch(err => {
			console.log(err);
			res.redirect("/profile");
		});
	});

	/*User defined functions*/
	function isLoggedIn(req, res, next) {
		if(req.isAuthenticated()) return next();
		res.redirect("/");
	}

	/*Start the server*/
	app.listen(3000, function(){
		console.log("Server has been created!!!");
	});
