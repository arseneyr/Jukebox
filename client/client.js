Router.route('/', {
  name: 'playlist',
  layoutTemplate: 'client',
  subscriptions: function() {
    return Meteor.subscribe('tracks');
  },

  action: function() {
    if (this.ready()) {
      this.render();
    } 
  }
});

SearchResults = new Mongo.Collection('searchResults');

Router.route('/search',  {
  name: 'search',
  layoutTemplate: 'client',
  yieldRegions: {'searchDoneButton': {to: 'searchDoneButton'}},
  subscriptions: function() {
    return Meteor.subscribe('search', this.params.query.q);
  },

  action: function() {
    if (this.ready()) {
      $('.ui.grid.main > .row').dimmer('hide');
      $('#searchbar').val(this.params.query.q);
      this.render();
    } else {
      $('.ui.grid.main > .row').dimmer('show');
    }
  }
});

Template.search.helpers({
  'searchResults': function() {
    return SearchResults.find({});
  }
});

Template.search_bar.events({
  'keypress input, click .ui.button': function (event, template) {
    var input = template.$('input');
    var val = $.trim(input.val());
    if (val && (event.type != 'keypress' || event.which == 13)) {
      Router.go('search', {}, {query: 'q=' + encodeURIComponent(val)});
    }
  }
});

Template.search.events({
  'click .add.link.icon': function (event, template) {
    Tracks.insert(this.context);
    $(event.target).removeClass('add circle').addClass('green check circle');
  }
});

Template.searchDoneButton.events({
  'click': function (event, template) {
    Router.go('/');
  }
});

Template.track.helpers({
  'checkIcon': function() {
    if (this.icon) {
      return this.icon;
    } else if (this.context.userId === Meteor.userId() ||
               (Meteor.user() && Meteor.user().admin)) {

      return 'minus circle';
    }
  }
});

var name_modal;

Template.client.rendered = function () {
  name_modal = this.$('.ui.modal');
  name_modal
  .modal('setting', 'closable', false)
  .modal('show');
};

Template.playlist.helpers( {
  'currentTrack': function() {
    return Tracks.findOne({}, {sort: {createdAt: 1}});  
  },
  'queuedTracks': function() {
    return Tracks.find({}, {skip: 1, sort: {createdAt: 1}});
  },
  'queuedTracksExist': function() {
    return Tracks.find({}).count() > 1;
  }
});

Template.playlist.events({
  'click .minus.link.icon': function (event, template) {
    Tracks.remove(this.context._id);
  }
});

Template.client.helpers( {
  'usernameSet': function() {return !!(Meteor.userId())},
});

Template.name_popup.events({
  'input input': function (event, template) {
    template.$('.ui.button').toggleClass('disabled', !($.trim(event.target.value)));
    var input = $(event.target);
    if (input.hasClass('error-popped')) {
      input.removeClass('error-popped');
      input.popup('remove popup');
    }
  },

  'keypress input, click .ui.button': function (event, template) {
    var input = template.$('input');
    var val = $.trim(input.val());
    if (val && (event.type != 'keypress' || event.which == 13)) {
      Accounts.createUser({username: val, password: 'secret'}, function (err) {
        if (!err) {
          Tracker.autorun(function() {
            if (!Meteor.userId()) {
              Accounts.createUser({username: val, password: 'secret'});
            }
          });

          if (input.hasClass('error-popped')) {
              input.removeClass('error-popped');
              input.popup('remove popup');
          }

          name_modal.modal('hide');
        } else {
          input.addClass('error-popped');
          input.popup({
            on: 'manual',
            content: "That name's taken!",
            position: 'top right'
          }).popup('show');
        }
      });
    }
  }
});


Meteor.subscribe('tracks');
Meteor.subscribe('myTracks');
Meteor.subscribe('userData');