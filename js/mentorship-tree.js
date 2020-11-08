var tree_config = {
        container: "#mentorship-tree",
        animateOnInit: false,
        rootOrientation: "NORTH",
        siblingSeparation: 40,
        subtreeSeparation: 30,
        hideRootNode: true,
        scrollbar: "fancy",
        connectors: {
            type: "step",
        },

        // node properties
        node: {
            HTMLclass: "person",
            collapsable: true,
        },
        // animation: {
        //     nodeAnimation: "easeOutBounce",
        //     nodeSpeed: 700,
        //     connectorsAnimation: "bounce",
        //     connectorsSpeed: 700,
        // },
    },
    root = {};

var personData = [
    [
        "mav120",
        1,
        "Mathew Varughese",
        "CS 2020 | CSC VP 2018 - 2020, Mentorship Founder",
        "",
    ],
    ["brh114", 1, "Brandon He", "CS 2021", ""],
    ["zhw78", 2, "Zhengming Wang", "CS 2022 | CSC President 2020-Present", ""],
    [
        "rog13",
        3,
        "Richie Goulazian",
        "CS 2023 | CSC Director 2020-Present ",
        "",
    ],
    ["kb", 4, "Kabilan Balasubramani", "CS 2024", ""],
    ["agf", 2, "Aiden Grey Fertich", "CS 2022", ""],
    ["sr", 3, "Sydni Roller", "CS 2023", ""],
    ["cg", 3, "Caelo Go", "CS 2023", ""],
    ["ag", 4, "Alexandar Grattan", "CS+DNID 2023", ""],
];

const lastYear = 4;

var links = [
    ["mav120", "zhw78"],
    ["mav120", "rog13"],
    ["mav120", "kb"],
    ["brh114", "agf"],
    ["brh114", "sr"],
    ["agf", "cg"],
    ["agf", "ag"],
];

var personMap = personData.reduce(function (acc, val) {
    var text = personToText(val);
    var year = text._year;
    delete text._year;
    acc[val[0]] = {
        parent: null,
        _year: year,
        text: text,
    };
    return acc;
}, {});

// psuedo elements
// id -> {}, map of psuedos
var psuedoPersonMap = {};

personData.forEach((person) => {
    var id = person[0];
    var year = person[1];

    psuedoPersonMap[id] = [];
    psuedoPersonMap[id][0] = personMap[id];

    for (let i = year; i <= lastYear; i++) {
        psuedoPersonMap[id][i - year + 1] = {
            parent: psuedoPersonMap[id][0],
            childrenDropLevel: i - year > 0,
            pseudo: true,
        };
    }
});

var psuedos = [];

var nodes = links.map(function (link) {
    var mentorID = link[0];
    var menteeID = link[1];
    var mentor = personMap[mentorID];
    var mentee = personMap[menteeID];
    var menteeYear = mentee._year;
    var mentorYear = mentor._year;
    var diff = menteeYear - mentorYear;
    var parent;
    if (diff === 1) {
        parent = personMap[mentorID];
    } else {
        parent = psuedoPersonMap[mentorID][diff - 1];
        parent.used = true;
    }
    mentee.mentor = mentor;
    mentee.parent = parent;
    return mentee;
});

Object.keys(psuedoPersonMap).forEach(function (pittid) {
    var elements = psuedoPersonMap[pittid];
    const jawns = elements.filter(function (bol) {
        return bol.used;
    });
    psuedos = psuedos.concat(jawns);
});

var rootMentors = Object.keys(personMap)
    .filter(function (v) {
        return !personMap[v].mentor;
    })
    .map(function (k) {
        personMap[k].parent = root;
        return personMap[k];
    });

function personToText(person) {
    return {
        name: person[2],
        desc: person[3],
        _year: person[1],
    };
}

var nodes = [tree_config, root].concat(rootMentors, nodes, psuedos);

console.log(nodes);

var tree = new Treant(nodes);
