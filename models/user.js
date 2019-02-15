var mongoose = require("mongoose");
var localMongoose = require("passport-local-mongoose");

var UserSchema = new mongoose.Schema({
	username: {type: String, required: true},
	password: String,
	profile: {
		firstname: {type: String, required: true},
		lastname: {type: String, required: true},
		profilepicture: String,
		likes: [{name: String, image: String}]
	}
});

UserSchema.plugin(localMongoose);
module.exports = mongoose.model("user", UserSchema);