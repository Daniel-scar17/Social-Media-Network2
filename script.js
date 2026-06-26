let socialData = {};

let selectedPerson = null;

const dataColors = {
    Facebook:"#3498db",
    Instagram:"#e84393",
    TikTok:"#2d3436",
    Discord:"#6c5ce7",
    Twitter:"#00acee",
    YouTube:"#e74c3c"
};

const cy = cytoscape({

    container:document.getElementById("cy"),

    elements:[],

    style:[

        {
            selector:"node",
            style:{
                "background-color":"#4a90e2",
                "label":"data(label)",
                "color":"white",
                "text-valign":"center",
                "text-halign":"center",
                "font-size":"14px",
                "width":60,
                "height":60
            }
        },

        {
            selector:"edge",
            style:{
                "curve-style":"bezier",
                "width":5,
                "line-color":"data(color)",
                "label":"data(label)",
                "font-size":"10px",
                "text-background-color":"white",
                "text-background-opacity":1,
                "text-background-padding":"2px"
            }
        }

    ]

});

function makeId(name){

    return name
        .toLowerCase()
        .replace(/\s+/g,"_");
}

function addConnectedPerson(){

    const mainPerson =
        document.getElementById("mainPerson")
        .value
        .trim();

    const connectedPerson =
        document.getElementById("connectedPerson")
        .value
        .trim();

    if(!mainPerson || !connectedPerson){

        alert("Enter Main Person and Connected Person");
        return;
    }

    if(!socialData[mainPerson]){

        socialData[mainPerson] = {
            data:[]
        };
    }

    if(!socialData[connectedPerson]){

        socialData[connectedPerson] = {
            data:[]
        };
    }

    loadPeople();

    document.getElementById("connectedPerson").value = "";

    buildGraph();
}

function loadPeople(){

    const container =
        document.getElementById("peopleList");

    container.innerHTML = "";

    Object.keys(socialData).forEach(person => {

        const div = document.createElement("div");

        div.className = "person-card";

        if(person === selectedPerson){
            div.classList.add("selected");
        }

        div.innerHTML = person;

        div.onclick = () => {

            selectedPerson = person;

            loadPeople();

            showPersonData(person);
        };

        container.appendChild(div);
    });
}

function showPersonData(person){

    document.getElementById(
        "selectedPersonTitle"
    ).innerHTML = person;

    const container =
        document.getElementById("personData");

    container.innerHTML = "";

    const dataList =
        socialData[person].data;

    if(dataList.length === 0){

        container.innerHTML =
            "<p>No data yet.</p>";

        return;
    }

    dataList.forEach(item => {

        const tag =
            document.createElement("div");

        tag.className = "data-tag";

        tag.innerHTML = item;

        container.appendChild(tag);
    });
}

function addDataToSelectedPerson(){

    if(!selectedPerson){

        alert("Select a person first");
        return;
    }

    const data =
        document.getElementById("dataInput")
        .value
        .trim();

    if(!data){

        alert("Enter data/platform");
        return;
    }

    if(
        !socialData[selectedPerson]
        .data.includes(data)
    ){
        socialData[selectedPerson]
        .data.push(data);
    }

    document.getElementById("dataInput")
    .value = "";

    showPersonData(selectedPerson);

    buildGraph();
}

function buildGraph(){

    cy.elements().remove();

    const nodes = [];
    const edges = [];

    const people =
        Object.keys(socialData);

    people.forEach(person => {

        nodes.push({

            data:{
                id:makeId(person),
                label:person
            }

        });

    });

    for(let i = 0; i < people.length; i++){

        for(let j = i + 1; j < people.length; j++){

            const personA = people[i];
            const personB = people[j];

            const dataA =
                socialData[personA].data;

            const dataB =
                socialData[personB].data;

            const sharedData =
                dataA.filter(item =>
                    dataB.includes(item)
                );

            if(sharedData.length > 0){

                sharedData.forEach(shared => {

                    edges.push({

                        data:{
                            id:
                                makeId(personA)
                                + "_"
                                + makeId(personB)
                                + "_"
                                + shared,

                            source:makeId(personA),

                            target:makeId(personB),

                            label:shared,

                            color:
                                dataColors[shared]
                                || "#777"
                        }

                    });

                });

            }

        }

    }

    cy.add([...nodes,...edges]);

    cy.layout({

        name:"cose",
        animate:true,
        padding:40

    }).run();
}

buildGraph();
