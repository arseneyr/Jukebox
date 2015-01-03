Router.route('/player', {
	name: 'ytPlayer',
	subscriptions: function() {
    	return Meteor.subscribe('tracks');
  	},
  	onAction: function() {
  		if (this.ready()) {
  			this.render();
  		}
  	}
});

Template.ytPlayer.created = function() {
	Accounts.createUser({
		username: 'yt-player',
		password: 'yt-player'
	}, function (error) {
		if (error) {
			Meteor.loginWithPassword('yt-player', 'yt-player');
		}
	});

	$.getScript('https://www.youtube.com/iframe_api');
}

Meteor.startup(function () {
    Session.set('playerState', 'uninitialized');
});

onYouTubeIframeAPIReady = function() {
    Session.set('playerState', 'apiReady');
};

var player = {}, 
    backupPlayer = {},
    interval;

player.div = 'player1';
backupPlayer.div = 'player2';

function destroypl(pl) {
	pl.yt.destroy();	
	pl.yt = null;
	$('#' + pl.div).removeClass('offscreen');	
}

function swapPlayers(newPrimaryId) {
	destroypl(player);
	var temp = player;
	player = backupPlayer;
	backupPlayer = temp;
	$('#' + player.div).removeClass('offscreen');
	player.thisId = newPrimaryId;
}

Tracker.autorun(function() {
	var primary = Tracks.findOne({}, {sort: {createdAt: 1}});
	var secondary = Tracks.findOne({}, {skip: 1, sort: {createdAt: 1}});

	//
	// Invalidation if current video changes.
	//

	if (player.yt && (!primary || !EJSON.equals(player.thisId, primary._id))) {
		switch (Session.get('playerState'))	{
			case 'waitingForPlayerReady':
				return;

			case 'playerPlaying':
			case 'beginBackupQueuing':
				Session.set('playerState', 'apiReady');
				break;

			case 'waitingForBackupPlayer':
				if (primary && primary.trackId == backupPlayer.trackId) {					
					Session.set('waitingForPlayerReady');
					return;
				}

				Session.set('playerState', 'apiReady');
				break;

			case 'backupQueued':
				if (primary && primary.trackId == backupPlayer.trackId) {
					swapPlayers(primary._id);
					Session.set('playerState', 'waitingForPlayerReady');
					player.yt.playVideo();
					return;
				} else {
					destroypl(backupPlayer);
					Session.set('playerState', 'apiReady');
				}

				break;
			}
	}

	if (backupPlayer.yt && (!secondary || backupPlayer.trackId != secondary.trackId)) {
		switch (Session.get('playerState')) {
			case 'waitingForBackupPlayer':
				return;

			case 'backupQueued':
				destroypl(backupPlayer);
				Session.set('playerState', 'beginBackupQueuing');
				break;
		}
	}

	switch (Session.get('playerState')) {
		case 'uninitialized':
			return;

		case 'apiReady':
			if (interval) {
				Meteor.clearInterval(interval);
				interval = null;
			}

			if (player.yt) {
				destroypl(player);
			}

			if (!primary) {
				return;
			}

			player.yt = new YT.Player(player.div, {
	        	height: screen.height,
	        	width: screen.width,
	        	videoId: primary.trackId,
		        events: {
		            'onStateChange': onStateChange
		        },
		        playerVars: {
		            autoplay: 1,
		            iv_load_policy: 3,
		            disablekb: 1,
		            controls: 0,
		            modestbranding: 1,
		            rel: 0,
		            showinfo: 0
		        }			
			});

			player.thisId = primary._id;
			player.trackId = primary.trackId;
			Session.set('playerState', 'waitingForPlayerReady');
			return;

		case 'playerPlaying':
			if (!interval) {
				interval = Meteor.setInterval(function() {
					if (player.yt.getVideoLoadedFraction() > 0.95) {
						Meteor.clearInterval(interval);
						interval = null;
						Session.set('playerState', 'beginBackupQueuing');
					}
				}, 1000);
			}

			return;

		case 'beginBackupQueuing':
			 if (!secondary) {
			 	return;
			 }

			$('#' + backupPlayer.div).addClass('offscreen');
			backupPlayer.yt = new YT.Player(backupPlayer.div, {
	        	height: screen.height,
	        	width: screen.width,
	        	videoId: secondary.trackId,
		        events: {
		            'onStateChange': onStateChange
		        },
		        playerVars: {
		            autoplay: 1,
		            iv_load_policy: 3,
		            disablekb: 1,
		            controls: 0,
		            modestbranding: 1,
		            rel: 0,
		            showinfo: 0
		        }			
			});

			backupPlayer.trackId = secondary.trackId;
			Session.set('playerState', 'waitingForBackupPlayer');
			return;
	}
});

onStateChange = function(event) {
	if (event.target == player.yt && 
		event.data == YT.PlayerState.PLAYING &&
		Session.get('playerState') == 'waitingForPlayerReady') {
        
        event.target.setPlaybackQuality('hd1080');
    	event.target.setVolume(100);

		var primary = Tracks.findOne({}, {sort: {createdAt: 1}});
		if (!primary || !EJSON.equals(player.thisId, primary._id)) {
			if (!primary || primary.trackId != player.trackId) {
				player.yt.pauseVideo();
				return Session.set('playerState', 'apiReady');
			} else {
				//
				// Still playing the same track, so patch up the id and continue.
				//

				player.thisId = primary._id;
			}
		}

		return Session.set('playerState', 'playerPlaying');

	} else if (event.target == backupPlayer.yt &&
			   event.data == YT.PlayerState.PLAYING) {

		var secondary = Tracks.findOne({}, {skip: 1, sort: {createdAt: 1}});

		if (Session.get('playerState') == 'waitingForBackupPlayer' &&
			secondary && secondary.trackId == backupPlayer.trackId) {
	        event.target.setPlaybackQuality('hd1080');
	    	event.target.setVolume(100);
			backupPlayer.yt.pauseVideo();
			Session.set('playerState', 'backupQueued');
		} else {
			destroypl(backupPlayer);
			if (Session.get('playerState') == 'waitingForBackupPlayer') {
				Session.set('playerState', 'beginBackupQueuing');
			}
		}
	} else if (event.target == player.yt && 
			   event.data == YT.PlayerState.ENDED) {

		Tracks.remove(player.thisId);
	}
}
