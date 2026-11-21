'use strict';
const paths = {
 camera:'M3 7h4l2-3h6l2 3h4v13H3z M16 13a4 4 0 1 1-8 0 4 4 0 1 1 8 0z',
 image:'M3 4h18v16H3z M3 16l5-5 4 4 3-4 6 6 M16 8h.1',
 wave:"M3 10v4m4-8v12m5-15v18m5-15v12m4-8v4",
 new:'M13 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-7 M10 14l1-4 7-7 3 3-7 7-4 1z',
 sliders:'M4 7h7m5 0h4M4 17h2m5 0h9 M14 4v6M8.5 14v6',
 plus:'M12 5v14M5 12h14', close:'M6 6l12 12M18 6L6 18',
 chat:'M4 5h16v11H9l-5 4z', desk:'M3 9l9 5 9-5-9-5-9 5z M3 13l9 5 9-5M3 17l9 5 9-5',
 history:'M3 10a9 9 0 1 1 2 8M3 4v6h6 M12 7v6l3 2',
 globe:'M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0zM3 12h18M12 3a17 17 0 0 1 0 18 17 17 0 0 1 0-18z',
 mic:'M9 6a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0zM5 11a7 7 0 0 0 14 0 M12 18v3M9 21h6',
 arrow:'M12 19V5M6 11l6-6 6 6', stop:'M7 7h10v10H7z', right:'M6 12h12m-5-5 5 5-5 5',
 down:'m8 10 4 4 4-4', compass:'M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0zM16 8l-3 6-5 2 3-6 5-2z',
 pen:'M4 17l-1 4 4-1L20 7l-3-3L4 17z M14 7l3 3', list:'M9 6h11M9 12h11M9 18h11M3 6l1 1 2-3M3 12l1 1 2-3M3 18l1 1 2-3',
 note:'M5 3h10l4 4v14H5zM14 3v5h5M8 13h8M8 17h6', copy:'M8 8h11v13H8zM5 16H3V3h11v2',
 sound:'M3 9h4l5-4v14l-5-4H3zM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
 more:'M5 12h.1M12 12h.1M19 12h.1', sendout:'M13 5h6v6 M19 5l-8 8 M10 5H5v14h14v-5',
 fork:'M6 4v16m0-5c0-6 12-2 12-10m-3 2 3-3 3 3', search:'M16 10a6 6 0 1 1-12 0 6 6 0 1 1 12 0zM15 15l5 5',
 link:'M10 14l4-4 M8 16l-1 1a3 3 0 0 1-4-4l4-4a3 3 0 0 1 4 0 M13 15a3 3 0 0 0 4 0l4-4a3 3 0 0 0-4-4l-1 1',
 spark:'M12 3q0 8-8 9 8 1 8 9 1-8 8-9-8-1-8-9z', clip:'M8 13l7-7a3 3 0 0 1 4 4l-9 9a5 5 0 0 1-7-7l10-10',
 eye:'M2 12q10-14 20 0-10 14-20 0zM15 12a3 3 0 1 1-6 0 3 3 0 1 1 6 0z',
 check:'M4 12l5 5L20 6', trash:'M3 6h18M8 6V3h8v3M6 6l1 15h10l1-15',
 export:'M12 14V3m-4 4 4-4 4 4M4 14v6h16v-6',
 moon:'M19 15A8 8 0 0 1 9 4a8 8 0 1 0 10 11z',
 back:'M19 12H5m6-6-6 6 6 6', lock:'M6 10h12v10H6zM8 10V7a4 4 0 0 1 8 0v3', book:'M3 5q4-2 9 1 5-3 9-1v14q-4-2-9 1-5-3-9-1zM12 6v14'
};
function icon(name) {
 const p = paths[name] || paths.spark;
 return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+(name==='more'?3.6:1.65)+'" stroke-linecap="round" stroke-linejoin="round"><path d="'+p+'"/></svg>';
}
