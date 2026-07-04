/* ================================================================
   home-builder.js – builds the home page post lists from the same
                     map-data.js config, keeping layout and tabs
   ================================================================ */
"use strict";

document.addEventListener("DOMContentLoaded", function () {
  // 1. make sure we actually have data, because sometimes stuff breaks
  if (!window.__MAP_DATA || !window.__MAP_DATA.nodes) {
    console.warn("home-builder: No __MAP_DATA found, sticking with static lists.");
    return;
  }

  const allNodes = window.__MAP_DATA.nodes;

  // 2. filter out nodes hidden on the home page (hideOnHome flag)
  const nodes = allNodes.filter((n) => !n.hideOnHome);

  // 3. group by type (posts, stories, dregs)
  const groups = { post: [], story: [], dreg: [] };
  nodes.forEach((node) => {
    if (groups[node.type]) {
      groups[node.type].push(node);
    }
  });

  // 4. sort each group newest first, because i like seeing fresh stuff
  Object.keys(groups).forEach((type) => {
    groups[type].sort((a, b) => new Date(b.date) - new Date(a.date));
  });

  // 5. build the actual HTML lists for each tab
  const tabIds = {
    post: "content-posts",
    story: "content-stories",
    dreg: "content-dregs",
  };

  Object.keys(tabIds).forEach((type) => {
    const tab = document.getElementById(tabIds[type]);
    if (!tab) return;

    const items = groups[type];
    if (!items.length) {
      // no items, keep it empty (maybe a sad face later)
      tab.innerHTML = "";
      return;
    }

    let html = '<ul class="post-list">';
    items.forEach((post) => {
      html += "<li>";
      html += '<div class="post-date">' + escHTML(post.date) + "</div>";
      html +=
        '<div class="post-title"><a href="' +
        escHTML(post.href) +
        '">' +
        post.title + // raw html so my <span> stylings work (you're all mommy's now :drooling_face:)
        "</a></div>";
      html += "</li>";
    });
    html += "</ul>";

    // dump it all into the tab, overwriting static fallback
    tab.innerHTML = html;
  });

  // helper to escape stuff, but i don't use it on titles because i trust myself
  function escHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
});