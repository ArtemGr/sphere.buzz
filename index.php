<?php
  // NB: To see the PHP error log in codeanywhere: $ sudo tail -f /var/log/apache2/error.log

  $cu = curl_init ('http://sphere.buzz/r');  // TODO: Use 'localhost' when working alongside the service.
  curl_setopt ($cu, CURLOPT_RETURNTRANSFER, 1);
  curl_setopt ($cu, CURLOPT_HTTPHEADER, [
    'X-Mode: about',
    'Host: sphere.buzz',
    'User-Agent: PHP cURL',
    'Content-Type: application/json']);
  curl_setopt ($cu, CURLOPT_POST, 1);
  $about_request = json_encode ([
    'uri' => $_SERVER['REQUEST_URI']
  ], JSON_UNESCAPED_UNICODE);
  curl_setopt ($cu, CURLOPT_POSTFIELDS, $about_request);
  $about_response = curl_exec ($cu);
  $about_response = json_decode ($about_response, 1);
  curl_close ($cu);
  if (!empty ($about_response['location'])) {
    header ('Location: /' . $about_response['location']);
    return;}
  $about = $about_response['about'];
  $description = $about_response['description'];

  $local_chat_js_url = '/js/local_chat.js?lm=' . stat ('js/local_chat.js') [9];

  header ('Content-Type: text/html; charset=UTF-8');
?><!DOCTYPE html>
<html>
  <head>
    <title>
      <?= empty ($about) ? 'Local chat' : 'Local chat about ' . $about ?>
    </title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="google-site-verification" content="nKMgujdE7wF2eIDFpJw-MpErlB8AwO2HZIrprOhSgkA" />
    <link rel="stylesheet" href="//cdnjs.cloudflare.com/ajax/libs/noUiSlider/8.3.0/nouislider.min.css" />
    <?php if (empty ($description)) { ?>
      <meta name="robots" content="noindex" />
    <?php } ?>
    <style>
      body, html {height: 100%; margin: 0; overflow: hidden}
      div#about {
        position: absolute;
        background: #ffffff;
        cursor: default;
        top: 5%; height: 75%;
        left: 5%; width: 85%;
        padding: 20px;
        overflow-y: auto;
        border: solid black 1px;
        box-shadow: 1px 2px;
        z-index: 2}
      div#window {display: -webkit-flex; display: flex; flex-flow: column; -webkit-flex-flow: column; height: 100%}
      div#header {
        background-color: #fdf560; padding: .5em; cursor: default;
        display: -webkit-flex; display: flex; flex-flow: row; -webkit-flex-flow: row;
        min-height: calc(1em + 4px)}
      div#distance_slider {flex-grow: 1; max-width: 400px; height: 19px; margin-left: 1em; margin-right: 1.5em}
      div#distance_limit {margin-right: 1em}
      div#header_uri {}
      div#chat {position: relative; -webkit-flex-grow: 1; flex-grow: 1; overflow-y: auto}
      div#chat > div#shout_template {display: none}

      div.shout {
        display: flex;
        flex-flow: row;
        transition: background 0.2s}
      div.shout:hover {
        background: #f0f0f0}
      div.distance {
        display: inline;
        align-self: flex-end;
        min-width: 2em;
        text-align: right;
        padding-right: 4px;
        font-size: small;
        cursor: default;
        color: gray;
        position: relative;
        padding-bottom: 4px}
      span.distance_label {}
      div.distance_bar {
        position: absolute;
        bottom: 0px;
        width: 0px;
        height: 3px;
        background-color: #e0e0e0}
      span.nick {
        align-self: center;
        min-width: 7em;
        text-align: right;
        padding-right: 4px;
        font-size: small}
      span.line {
        flex-grow: 1;
        margin: 4px;
        padding: 4px;
        background-color: #f7f7f7;
        border-radius: 6px}

      div#chat > div#error, div#location_error {
        position: absolute; bottom: 5px;
        padding: 5px; border-radius: 10px; color: white; background: red; font-family: monospace; cursor: default}
      div#chat > div#error {right: 5px; display: none}
      div#chat > div#location_error {left: 5px}
      div#prompt {
        background-color: #f7c640; display: -webkit-flex; display: flex; flex-flow: row; -webkit-flex-flow: row;
        min-height: calc(1em + 22px)}

      div#prompt > input {margin: .5em}
      div#prompt > input[name="line"] {flex-grow: 1; -webkit-flex-grow: 1}

      @media (max-width: 400px) {
        div#about {width: 75%}
        div#prompt {min-height: calc(1em + 16px)}  /* A bit smaller than on a large screen. */
        div#prompt > input[name="nick"] {min-width: 4em; min-height: 1em}  /* Let the nick be smaller than usual on lanky screens. */
        div#prompt > input[name="line"] {min-width: 4em; min-height: 1em}
        div#prompt > input[type="button"] {min-height: 1em}
        div#messages > div.shout > span.nick {min-width: 4em}}
    </style>
  </head>
  <body data-room="<?= $about ?>">
    <div id="about" style="<?= empty ($description) ? 'display: none' : '' ?>">
      <?= $description ?>
    </div>
    <div id="window">
      <div id="header">
        <div id="distance_slider"></div>
        <div id="distance_limit"></div>
        <div id="header_uri">
          / <?= $about ?>
        </div>
      </div>
      <div id="chat">
        &nbsp;
        <div id="shout_template">
          <div class="distance">
            <span class="distance_label"></span>
            <div class="distance_bar"></div>
          </div>
          <span class="nick"></span>
          <span class="line"></span>
        </div>
        <div id="messages"></div>
        <div id="location_error">
          Sorry, can't figure out your current location.
        </div>
        <div id="error">
          Ups
        </div>
      </div>
      <div id="prompt">
        <input type="text" name="line" placeholder="Type your message here" />
        <input type="text" name="nick" placeholder="Nick" />
        <input type="button" value="Shout" />
      </div>
    </div>

    <script src="//ajax.googleapis.com/ajax/libs/jquery/2.2.4/jquery.min.js"></script>
    <script src="//cdnjs.cloudflare.com/ajax/libs/noUiSlider/8.3.0/nouislider.min.js"></script>
    <script src="//cdn.jsdelivr.net/fingerprintjs2/1.0.3/fingerprint2.min.js"></script>
    <script src="<?= $local_chat_js_url ?>"></script>

    <?php include 'include/yandex_counter.php' ?>
  </body>
</html>
