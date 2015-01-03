Meteor.setInterval(function () {
	Meteor.users.remove({createdAt: {$lt: new Date(Date.now() - 86400000)}});
	}, 60000);

Accounts.config({loginExpirationInDays: 1});
Accounts.onCreateUser(function (options, user) {
	if (/^bad motherfucker$/.test(user.username)) {
		user.admin = true;
	}

	return user;
});
Meteor.publish("userData", function() {
	return Meteor.users.find({_id: this.userId, admin: true}, {fields: {'admin':1}});
});

Tracks.allow({
	insert: function (userId, doc) {
		return true;
	},

	remove: function (userId, doc) {
		return Meteor.user().username == 'yt-player' || 
			   Meteor.user().admin || 
			   doc.userId == userId;
	}
})

Tracks.before.insert(function (userId, doc) {
	doc.createdAt = Date.now();
	doc.username = Meteor.user().username;
	doc.userId = userId;
	doc.trackId = doc._id;
	delete doc._id;
});

Meteor.publish('tracks', function() {
	return Tracks.find({}, {
		fields: {userId: 0}
	});
});

Meteor.publish('myTracks', function() {
	return Tracks.find({userId: this.userId}, {fields: {userId:1}});
});

Meteor.publish('search', function(query) {
	var self = this;

	HTTP.call('GET', 'https://www.googleapis.com/youtube/v3/search', {
		params: {
			part: 'snippet',
			q: query,
			type: 'video',
			key: 'AIzaSyA7UOF4EcfZgMEzLkiiHtBmPE368_gguV0',
			maxResults: 50,
			fields: 'items(id/videoId, snippet(title,thumbnails/medium/url))'
		}
	}, function (error, result) {
		if (error) {
			return self.error(error);
		}

		result.data.items.map(function (i) {
			self.added('searchResults', i.id.videoId, {title: i.snippet.title, thumbnail: i.snippet.thumbnails.medium.url});
		});

		self.ready();
	});
});