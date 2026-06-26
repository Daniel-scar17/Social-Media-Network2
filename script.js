const socialData = {
    Daniel: ["Facebook", "TikTok", "Instagram", "X"],
    Kelly: ["Facebook", "TikTok"],
    April: ["X", "Instagram"],
    Craig: ["TikTok"],
    Viel: []
};

let selectedPerson = null;

const cy = cytoscape({
    container: document.getElementById("cy"),
    elements: [],

    style: [
        {
            selector: "node",
            style: {
                "background-color": "data(color)",
                "label": "data(label)",
                "text-valign": "center",
                "text-halign": "center",
                "color": "#222",
                "width": 70,
                "height": 70
            }
        },
        {
            selector: "node.selected",
            style: {
                "background-color": "#2ecc71",
                "border-width": 4,
                "border-color": "#27ae60"
            }
        },
        {
            selector: "edge",
            style: {
                "width": 5,
                "curve-style": "bezier",
                "line-color": "data(color)",
                "label": "data(platform)",
                "font-size": 12,
                "text-background-color": "#fff",
                "text-background-opacity": 1,
                "text-background-padding": 3
            }
        }
    ]
});

function makeId(name){
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function getNodeColor(person){
    const colors = {
        Daniel: "#e74c3c",
        Kelly: "#3498db",
        April: "#f1c40f",
        Craig: "#9b59b6",
        Viel: "#95a5a6"
    };

    return colors[person] || "#4a90e2";
}

function getPlatformColor(platform){
    if(platform === "Facebook"){
        return "#1877F2";
    }

    if(platform === "Instagram"){
        return "#8e44ad";
    }

    if(platform === "TikTok"){
        return "#000000";
    }

    if(platform === "X"){
        return "#777777";
    }

    return "#999999";
}

function selectPerson(person){
    selectedPerson = person;

    document.querySelectorAll(".person-buttons button").forEach(button => {
        button.classList.remove("active");
    });

    event.target.classList.add("active");

    document.getElementById("details").innerHTML = `
        <h3>${person}</h3>
        <p>Selected person: <b>${person}</b></p>
        <p>Click <b>Find Connection</b> to view connections.</p>
    `;
}

function findConnection(){
    if(!selectedPerson){
        alert("Select a person first.");
        return;
    }

    cy.elements().remove();

    const nodes = [];
    const edges = [];
    const people = Object.keys(socialData);

    people.forEach(person => {
        nodes.push({
            data: {
                id: makeId(person),
                label: person,
                color: getNodeColor(person)
            },
            classes: person === selectedPerson ? "selected" : ""
        });
    });

    people.forEach(person => {
        if(person === selectedPerson){
            return;
        }

        const sharedPlatforms = socialData[selectedPerson].filter(platform =>
            socialData[person].includes(platform)
        );

        sharedPlatforms.forEach(platform => {
            edges.push({
                data: {
                    id: makeId(selectedPerson) + "_" + makeId(person) + "_" + platform,
                    source: makeId(selectedPerson),
                    target: makeId(person),
                    platform: platform,
                    color: getPlatformColor(platform)
                }
            });
        });
    });

    cy.add([...nodes, ...edges]);

    cy.layout({
        name: "cose",
        animate: true,
        padding: 50
    }).run();

    showDetails();
}

function showDetails(){
    let html = `
        <h3>${selectedPerson}</h3>
        <b>Platforms:</b>
        <ul>
            ${
                socialData[selectedPerson].length > 0
                ? socialData[selectedPerson].map(platform => `<li>${platform}</li>`).join("")
                : "<li>No social media platform</li>"
            }
        </ul>

        <hr>

        <b>Connections:</b>
    `;

    let hasConnection = false;

    Object.keys(socialData).forEach(person => {
        if(person === selectedPerson){
            return;
        }

        const sharedPlatforms = socialData[selectedPerson].filter(platform =>
            socialData[person].includes(platform)
        );

        if(sharedPlatforms.length > 0){
            hasConnection = true;

            html += `
                <p>
                    <b>${person}</b><br>
                    Same platform: ${sharedPlatforms.join(", ")}
                </p>
            `;
        }
    });

    if(!hasConnection){
        html += `<p>No connection found. This person is isolated.</p>`;
    }

    html += `
        <hr>
        <b>Line Colors:</b>
        <div class="legend">
            <div class="legend-item">
                <span class="legend-line facebook"></span> Facebook
            </div>
            <div class="legend-item">
                <span class="legend-line instagram"></span> Instagram
            </div>
            <div class="legend-item">
                <span class="legend-line tiktok"></span> TikTok
            </div>
            <div class="legend-item">
                <span class="legend-line x"></span> X
            </div>
        </div>
    `;

    document.getElementById("details").innerHTML = html;
}
