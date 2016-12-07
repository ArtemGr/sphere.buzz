// If nick's empty then focus there. But only after we've got the location (so as not to mess things with mobile keyword popping up).
function lc_focus() {
  if ($('input') .is (':focus')) return;  // Already focused.
  if ($('div#about') .is (':visible')) return;  // Don't want to show no keyboard why the about page is up.
  if ($('input[name=nick]') .val().trim() == '') $('input[name=nick]') .focus()
  else {
    var $line = $('input[name=line]')
    $line.focus()
    if (typeof $line[0].selectionStart != 'undefined') $line[0].selectionStart = $line.val().length}}

// Send the given comment to server.
function lc_send (nick, line, comment_id, typing_update_num, cb) {
  var data = {
    room: $('body') .attr ('data-room'),
    comment_id: comment_id,
    nick: nick,
    browser_id: localStorage.browser_id,
    browser_fingerprint: window.browser_fingerprint,
    line: line,
    location: {latitude: lc_coordinates.latitude, longitude: lc_coordinates.longitude},
    distance: Number (slider.noUiSlider.get())}
  if (typing_update_num) data.typing_update_num = typing_update_num

  $.ajax ('http://sphere.buzz/', {method: 'POST', dataType: 'json', contentType: 'application/json',
    headers: {'X-Mode': 'comment'},
    data: JSON.stringify (data),
    success: function (ev) {
      if (cb) cb (ev)}})}

// Send the currently typed comment to the server.
function lc_send_typed ($nick, $line) {
  if (!window.lc_coordinates) return
  if (!localStorage.comment_id) return
  localStorage.typing_update_num = localStorage.typing_update_num ? Number (localStorage.typing_update_num) + 1 : 1
  lc_send ($('input[name=nick]').val().trim(), $('input[name=line]').val().trim(),
    Number (localStorage.comment_id), Number (localStorage.typing_update_num))}

// Submit the final version of the comment to the server, preparing the input field for the new comment.
function lc_send_final() {
  var $line = $('input[name=line]')
  if ($line.val().trim() == '') return;
  var nick = $('input[name=nick]').val().trim()
  var line = $('input[name=line]').val().trim()
  var comment_id = Number (localStorage.comment_id)
  $line.val ('')
  $line.attr ('data-prev', '')
  localStorage.removeItem ('line')
  localStorage.removeItem ('comment_id')
  localStorage.removeItem ('typing_update_num')
  // TODO: Do not submit new stuff until the last one was delivered?
  lc_send (nick, line, comment_id, null, function (ev) {
    show_posted (function() {
      scroll_to_bottom()})})}

// See if there are changes in the typed comment and call `lc_send_typed` if there are.
function lc_detect_line_changes() {
  var $line = $('input[name=line]')
  var lv = $line.val().trim()
  var $nick = $('input[name=nick]')
  var nv = $nick.val().trim()
  var prev = $line.attr ('data-prev')
  prev = typeof prev == 'undefined' ? '' : prev
  if (prev == lv) return;  // Not changed.

  if (!localStorage.comment_id || localStorage.comment_id == 'NaN') localStorage.comment_id = Math.ceil (Math.random() * Number.MAX_SAFE_INTEGER)

  localStorage.line = lv  // In order to restore it after a page reload.
  $line.attr ('data-prev', lv)

  // Submit the changes a while later.
  if (!lc_detect_line_changes.timeouts) lc_detect_line_changes.timeouts = []
  var timeout; while (timeout = lc_detect_line_changes.timeouts.pop()) clearTimeout (timeout);
  lc_detect_line_changes.timeouts.push (setTimeout (function() {lc_send_typed ($nick, $line)}, 1000));}

function scroll_to_bottom() {
  $chat = $('div#chat')
  $chat.scrollTop ($chat.prop ('scrollHeight') - $chat.innerHeight())}

// True if the chat currently displays the last message.
function at_bottom() {
  $chat = $('div#chat')
  var haveScroll = $chat.scrollTop()
  var maxScroll = $chat.prop ('scrollHeight') - $chat.innerHeight()
  return Math.abs (haveScroll - maxScroll) < 32}  // NB: Precise match doesn't always cut it, there are fluctuations.

// Render the tape (display the chat messages).
function refresh_the_chat (updates) {
  var shouts = updates.shouts
  var max_distance = Number (slider.noUiSlider.get())
  var was_at_bottom = at_bottom()

  for (var si = 0; si < shouts.length; ++si) {
    var shout = shouts[si]
    $shout = $('div#shout_template').clone()
    var old_shout = $('div#shout_' + shout.comment_id) .remove()

    // If the shout wasn't present earlier or was only a preview, and if the shout is no longer a preview.
    if ((old_shout.length == 0 || old_shout.filter ('.typing') .length != 0) && !shout.typing_update_num) {
      if (window.Notification && Notification.permission == 'granted') {
        // Only show notifications if the chat's bottom is not currently visible.
        if ('visible' != document.visibilityState || !was_at_bottom) {
          if (!refresh_the_chat.last_notification) refresh_the_chat.last_notification = Date.now()
          if (!refresh_the_chat.notifications) refresh_the_chat.notifications = []
          if (Date.now() - refresh_the_chat.last_notification > 12000) {
            refresh_the_chat.last_notification = Date.now()
            if (window.navigator && navigator.vibrate) navigator.vibrate (200)
            // NB: Android Chrome needs HTTPS and a Service Worker for notifications to work, see #111834461.
            // This only works with FF and *Desktop* Chrome:
            try {
              // Explicitly close all the previous notifications (mobile FF seems to ignore the absence of the `requireInteraction` option).
              while (refresh_the_chat.notifications.length) {
                var notification = refresh_the_chat.notifications.pop()
                if (notification.close) notification.close()}

              refresh_the_chat.notifications.push (
                new Notification ($('title').text(), {
                  body: shout.nick + ': ' + shout.line,
                  sound: '/sounds/notification.wav',
                  lang: 'en'}))
            } catch (ex) {if (window.console && console.error) console.error (ex)}}}}}

    $shout.attr ('id', 'shout_' + shout.comment_id)
    $shout.attr ('data-lm', shout.lm)
    if (shout.typing_update_num) $shout.addClass ('typing')
    $('div#messages') .append ($shout)
    var distance_km = shout.shout_info.distance_km
    $shout.attr ('data-distance', distance_km)
    if (distance_km > 10) distance_km = Math.round (distance_km)
    else if (distance_km > 1) distance_km = Math.round (distance_km * 10) / 10
    if (distance_km > max_distance) continue  // In case the slider was updated inbetwixt.
    $shout.find ('span.distance') .attr ('title', 'Approximate distance from you to ' + shout.nick + ' is ' + distance_km + ' km.')
    $shout.find ('span.distance_label') .html (distance_km)
    distance_bar_length ($shout, distance_km, max_distance)
    $shout.find ('span.nick') .html (shout.nick)
    $shout.find ('span.line') .html (shout.line)
    $shout.addClass ('shout')}

  if (was_at_bottom) scroll_to_bottom()}

// Performs the AJAX request fetching the shouts from the server.
function fetch_shouts (max_lm, success, error) {
  var request = {
    room: $('body') .attr ('data-room'),
    max_lm: max_lm,
    browser_id: localStorage.browser_id,
    browser_fingerprint: window.browser_fingerprint,
    location: {latitude: lc_coordinates.latitude, longitude: lc_coordinates.longitude},
    distance: Number (slider.noUiSlider.get())}

  $.ajax ('http://sphere.buzz/', {method: 'POST', dataType: 'json', contentType: 'application/json',
    headers: {'X-Mode': 'fetch_updates'},
    data: JSON.stringify (request),
    success: success,
    error: error})}

// Get an IP-based location from the server.
function ip2loc (success, error) {
  $.ajax ('http://sphere.buzz/', {method: 'POST', dataType: 'json', contentType: 'application/json',
    headers: {'X-Mode': 'ip2loc'},
    data: JSON.stringify ({}),
    success: success,
    error: error})}

// Get the max timestamp from the loaded shouts.
function max_lm (filter) {
  var $shouts = $('div.shout')
  var max_lm = 0
  for (var ix = 0; ix < $shouts.length; ++ix) {
    var $shout = $($shouts[ix])
    if (filter && !filter ($shout)) continue
    var lm = Number ($shout.attr ('data-lm'))
    if (lm > max_lm) max_lm = lm}
  return max_lm}

// Load fresh chat comments from the server.
function fetch_server_updates() {
  if (!window.lc_coordinates) return

  if (fetch_server_updates.fetching || Date.now() - fetch_server_updates.last_fetch < 1000) return
  fetch_server_updates.fetching = true

  // See if we need to increase the distance.
  fetch_server_updates.num = fetch_server_updates.num ? fetch_server_updates.num + 1 : 1
  var distance = Number (slider.noUiSlider.get())
  if (fetch_server_updates.num > 1 && distance < 40000 && !on_slide.slider_used) {
    var nick = $('input[name=nick]').val().trim()
    var max_fellow_lm = max_lm (function ($shout) {$shout.find ('span.nick') .text() != nick});
    if (Date.now() / 1000 - max_fellow_lm > 3600 * 3) {
      slider.noUiSlider.set (distance < 10000 ? distance * 10 : distance * 2)
      render_distance_limit()
      distance_limit_changed()
      fetch_server_updates.fetching = false
      return}}

  fetch_shouts (max_lm(),
    function (ev) {
      fetch_server_updates.fetching = false
      fetch_server_updates.last_fetch = Date.now()
      refresh_the_chat (ev)},
    function() {
      fetch_server_updates.fetching = false
      fetch_server_updates.last_fetch = Date.now()})}

// Wipe the existing entries and load a fresh set from the server.
function reload() {
  fetch_shouts (0, function (ev) {
    $('div.shout').remove()
    fetch_server_updates.last_fetch = Date.now()
    refresh_the_chat (ev)})}

// Immediately fetch a fresh set of updates from the server.
function show_posted (cb) {
  fetch_shouts (max_lm(), function (ev) {
    fetch_server_updates.last_fetch = Date.now()
    refresh_the_chat (ev)
    if (cb) cb()})}

// Ping the browser for the current location.
function location_update() {
  if (Date.now() - location_update.last_attempt < 600 * 1000) return
  location_update.last_attempt = Date.now()

  location_update.browser_error = null
  location_update.server_error = null

  function show_error() {
    var msg = ''
    if (location_update.browser_error) msg = 'Browser says: "' + location_update.browser_error + '"'
    if (location_update.server_error) {
      if (msg) msg += '; '
      msg += 'Server says: "' + location_update.server_error + '".'}
    $('div#location_error') .attr ('title', msg) .show()}

  function update_from_server() {
    ip2loc (function (coordinates) {
      $('div#location_error') .hide()
      window.lc_coordinates = coordinates
      if (window.console && console.info)
        console.info ("Location obtained from server: latitude " + coordinates.latitude + "; longitude " + coordinates.longitude + ".")
      lc_focus()
    }, function (error) {
      if (error.responseJSON && error.responseJSON.error && window.console && console.error) console.error (error.responseJSON.error)
      location_update.server_error = error.statusText
      show_error()})}

  // https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/Using_geolocation
  if (navigator.geolocation) navigator.geolocation.getCurrentPosition (
    function (position) {
      $('div#location_error') .hide()
      var coordinates = position.coords || position.coordinate || position
      window.lc_coordinates = coordinates
      if (window.console && console.info)
        console.info ("Location obtained from the browser: latitude " + coordinates.latitude + "; longitude " + coordinates.longitude + ".")
      lc_focus()},
    function (error) {
      if (error.message) {
        if (window.console && console.error) console.error (error.message)
        location_update.browser_error = error.message}
      show_error()
      update_from_server()},
    {maximumAge: 86400000, timeout: 20000})
  else update_from_server()}

// Update the length of the distance bar relative to the current slider's maximum.
function distance_bar_length ($shout, distance_km, max_distance) {
  // NB: `span.nick`'s `min-width` is "7em".
  var width = Math.min (7, Math.round (7 * (distance_km / max_distance) * 10) / 10) + 'em'
  $shout.find ('div.distance_bar') .css ('width', width)}

// Display the current distance limit in the header.
function render_distance_limit() {
  var max_distance = Number (slider.noUiSlider.get())
  var with_label = max_distance < 1
    ? max_distance * 1000 + ' meters'
    : max_distance + ' km'
  $('div#distance_limit') .html (with_label)

  var $shouts = $('div.shout')
  for (var ix = 0; ix < $shouts.length; ++ix) {
    var $shout = $($shouts[ix])
    distance_bar_length ($shout, $shout.attr ('data-distance'), max_distance)}}

function on_slide() {
  on_slide.slider_used = true
  render_distance_limit()}

// Removes from the chat the messages with the distance greater than the current max setting.
function trim_to_distance() {
  var max_distance = Number (slider.noUiSlider.get())
  var $shouts = $('div.shout')
  for (var ix = 0; ix < $shouts.length; ++ix) {
    var $shout = $($shouts[ix])
    if ($shout.attr ('data-distance') > max_distance) {$shout.remove(); continue}
    distance_bar_length ($shout, $shout.attr ('data-distance'), max_distance)}}

// React to user changing the distance slider.
function distance_limit_changed() {
  // When the distant *decreases* we might keep the existing chat entries but trim the ones that's too far.
  // When the distant *increases* we need to reload the entire chat so that the distance is uniform across time.

  var distance = Number (slider.noUiSlider.get())
  var prev = distance_limit_changed.prev
  distance_limit_changed.prev = distance

  if (distance < prev) {
    trim_to_distance()
  } else if (distance > prev) {
    refresh_the_chat.last_notification = Date.now()  // Never show a notification because of a manual distance change.
    reload()}}

// --- Initialization ---

if (!('MAX_SAFE_INTEGER' in Number)) Number.MAX_SAFE_INTEGER = 9007199254740991  // MSIE 11 fix.

if ($('div#about') .is (':visible')) {
  var now = Math.round (Date.now() / 1000)
  if (now - localStorage.saw_about < 86400) {
    $('div#about') .hide()
  } else {
    function hide_about() {
      $(document).off ('click', hide_about)
      $('div#about') .hide()
      localStorage.saw_about = now
      lc_focus()}
    $(document).on ('click', hide_about)}}

if (localStorage.nick) $('input[name=nick]') .val (localStorage.nick) .attr ('data-prev', localStorage.nick)
if (localStorage.line) $('input[name=line]') .val (localStorage.line) .attr ('data-prev', localStorage.line)

// Handle the Enter key.
$('input') .keyup (function (ev) {if (ev.keyCode == 13) $(this).trigger ('keyEnter')})
$('input[name=nick]') .on ('keyEnter', function() {
  if ($('input[name=nick]') .val().trim() != '')
    $('input[name=line]') .focus()})
$('input[name=line]') .on ('keyEnter', lc_send_final)
$('div#prompt > input[type=button]') .on ('click', lc_send_final)

// Save nick when it's changed.
$('input[name=nick]') .on ('change', function() {
  var nick = $(this).val().trim()
  if (nick != '') localStorage.nick = nick})

var slider = document.getElementById ('distance_slider')
if (slider == null) throw "!slider"
noUiSlider.create (slider, {  // http://refreshless.com/nouislider/
  start: 10,
  connect: 'lower',
  range: {
    'min': 0.5,
    // http://refreshless.com/nouislider/examples/#section-non-linear
    '5%': [1, 1],
    '20%': [10, 2],
    '60%': [100, 10],
    '80%': [1000, 100],
    'max': 40000}})  // Circumference. That's how big the Earth is.

render_distance_limit()
slider.noUiSlider.on ('slide', on_slide)
distance_limit_changed.prev = Number (slider.noUiSlider.get())
slider.noUiSlider.on ('change', distance_limit_changed)

if (!localStorage.browser_id || localStorage.browser_id == 'NaN') localStorage.browser_id = Math.ceil (Math.random() * Number.MAX_SAFE_INTEGER)
new Fingerprint2() .get (function (fingerprint, _) {window.browser_fingerprint = fingerprint})

setInterval (function() {
  location_update()
  lc_detect_line_changes()
  fetch_server_updates()
}, 200)

if (window.Notification && Notification.permission != 'granted') Notification.requestPermission()
