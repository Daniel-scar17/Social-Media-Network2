import { db } from "./firebase.js";
import { defaultSocialData } from "./data.js";

import {
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

let socialData = {};
let currentGroup = [];
let selectedPerson = null;
let selectedNodeId = null;

const cy = cytoscape({
    container:document.getElementById("cy"),
    elements:[],

    style:[
        {
            selector:"node",
            style:{
                "background-color":"data(color)",
                "label":"data(label)",
                "text-valign":"center",
                "text-halign":"center",
                "color":"#222",
                "width":65,
                "height":65
            }
        },
        {
            selector:"edge",
            style:{
                "width":5,
                "curve-style":"bezier",
                "line-color":"data(edgeColor)",
                "label":"data(sharedLabel)",
                "font-size":12,
                "text-background-color":"#fff",
                "text-background-opacity":1,
                "text-background-padding":3
            }
        },
        {
            selector:"node.highlighted",
            style:{
                "background-color":"#2ecc71",
                "border-width":4,
                "border-color":"#27ae60"
            }
        }
    ]
});

window.setPeopleGroup = setPeopleGroup;
window.addDataToSelectedPerson = addDataToSelectedPerson;
window.searchPerson = searchPerson;
window.resetData = resetData;
window.toggleMenu = toggleMenu;
window.closeMenu = closeMenu;
window.toggleSocialFolder = toggleSocialFolder;
window.clearSearchText = clearSearchText;

function makeId(name){
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g,"_");
}

function normalizeName(name){
    return name
        .trim()
        .replace(/\s+/g," ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

function normalizeDataName(name){
    return name
        .trim()
        .replace(/\s+/g," ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

function findPersonKey(name){
    const search = name.toLowerCase();

    for(let person in socialData){
        if(person.toLowerCase() === search){
            return person;
        }
    }

    return null;
}

function getPlatformColor(platform){
    const colors = {
        Facebook:"#1877F2",
        Instagram:"#C13584",
        Tiktok:"#000000",
        TikTok:"#000000",
        X:"#777777"
    };

    return colors[platform] || "#8e44ad";
}

function getSharedPlatforms(personA, personB){
    const dataA = socialData[personA]?.platforms || [];
    const dataB = socialData[personB]?.platforms || [];

    return dataA.filter(item => dataB.includes(item));
}

async function loadDatabase(){
    const snapshot = await getDocs(collection(db,"people"));

    if(snapshot.empty){
        socialData = JSON.parse(JSON.stringify(defaultSocialData));
        await uploadDefaultData();
    }else{
        socialData = {};

        snapshot.forEach(document => {
            const data = document.data();

            socialData[document.id] = {
                platforms:Array.isArray(data.platforms) ? data.platforms : []
            };
        });
    }

    loadSocialFolders();

    document.getElementById("details").innerHTML =
        "Enter a main person and connected people, then add data/platforms to each person.";
}

async function uploadDefaultData(){
    for(let person in socialData){
        await setDoc(doc(db,"people",person), socialData[person]);
    }
}

async function savePerson(person){
    await setDoc(doc(db,"people",person), socialData[person]);
}

async function setPeopleGroup(){
    const mainPersonInput = normalizeName(
        document.getElementById("mainPerson").value
    );

    const connectedInput = document.getElementById("connectedPeople").value;

    if(!mainPersonInput){
        alert("Enter the main person.");
        return;
    }

    const mainPerson = findPersonKey(mainPersonInput) || mainPersonInput;

    const connectedPeople = connectedInput
        .split(/,|\n/)
        .map(name => normalizeName(name))
        .filter(name => name.length > 0)
        .map(name => findPersonKey(name) || name);

    currentGroup = [
        mainPerson,
        ...connectedPeople.filter(name => name !== mainPerson)
    ];

    currentGroup = [...new Set(currentGroup)];

    for(let person of currentGroup){
        if(!socialData[person]){
            socialData[person] = {
                platforms:[]
            };
        }

        if(!Array.isArray(socialData[person].platforms)){
            socialData[person].platforms = [];
        }

        await savePerson(person);
    }

    selectedPerson = mainPerson;

    loadSocialFolders();
    renderPeopleSelector();
    buildCurrentGroupGraph();
    showDetails(mainPerson);
}

function renderPeopleSelector(){
    const container = document.getElementById("personDataList");

    let html = "";

    currentGroup.forEach(person => {
        const activeClass = person === selectedPerson ? "active" : "";

        html += `
            <span class="person-chip ${activeClass}" onclick="selectPersonForData('${person}')">
                ${person}
            </span>
        `;
    });

    container.innerHTML = html;

    if(selectedPerson){
        updateSelectedPersonPanel();
    }
}

window.selectPersonForData = function(person){
    selectedPerson = person;
    renderPeopleSelector();
    showDetails(person);
};

function updateSelectedPersonPanel(){
    document.getElementById("selectedPersonTitle").innerHTML =
        "Add Data / Platform to " + selectedPerson;
}

async function addDataToSelectedPerson(){
    const dataName = normalizeDataName(
        document.getElementById("dataInput").value
    );

    if(!selectedPerson){
        alert("Select a person first.");
        return;
    }

    if(!dataName){
        alert("Enter data/platform.");
        return;
    }

    if(!socialData[selectedPerson]){
        socialData[selectedPerson] = {
            platforms:[]
        };
    }

    if(!Array.isArray(socialData[selectedPerson].platforms)){
        socialData[selectedPerson].platforms = [];
    }

    if(!socialData[selectedPerson].platforms.includes(dataName)){
        socialData[selectedPerson].platforms.push(dataName);
    }

    await savePerson(selectedPerson);

    document.getElementById("dataInput").value = "";

    loadSocialFolders();
    renderPeopleSelector();
    buildCurrentGroupGraph();
    showDetails(selectedPerson);
}

function buildCurrentGroupGraph(){
    cy.elements().remove();

    const nodes = [];
    const edges = [];

    currentGroup.forEach(person => {
        nodes.push({
            data:{
                id:makeId(person),
                label:person
            }
        });
    });

    for(let i = 0; i < currentGroup.length; i++){
        for(let j = i + 1; j < currentGroup.length; j++){
            const personA = currentGroup[i];
            const personB = currentGroup[j];

            const sharedPlatforms = getSharedPlatforms(personA, personB);

            if(sharedPlatforms.length > 0){
                const edgeColor =
                    sharedPlatforms.length === 1
                    ? getPlatformColor(sharedPlatforms[0])
                    : "#8e44ad";

                edges.push({
                    data:{
                        id:makeId(personA) + "_" + makeId(personB),
                        source:makeId(personA),
                        target:makeId(personB),
                        shared:sharedPlatforms,
                        sharedLabel:sharedPlatforms.join(", "),
                        edgeColor:edgeColor
                    }
                });
            }
        }
    }

    cy.add([...nodes, ...edges]);

    applyVertexColoring();

    cy.layout({
        name:"cose",
        animate:true,
        padding:50
    }).run();

    document.getElementById("details").innerHTML =
        "Graph generated. Edges appear only when people share the same data/platform.";
}

function buildSinglePersonGraph(person){
    cy.elements().remove();

    if(!socialData[person]){
        document.getElementById("details").innerHTML =
            "No saved data for " + person;
        return;
    }

    const group = [person];

    for(let otherPerson in socialData){
        if(otherPerson === person){
            continue;
        }

        const shared = getSharedPlatforms(person, otherPerson);

        if(shared.length > 0){
            group.push(otherPerson);
        }
    }

    currentGroup = [...new Set(group)];
    selectedPerson = person;

    renderPeopleSelector();
    buildCurrentGroupGraph();
    showDetails(person);
}

function applyVertexColoring(){
    const colors = [
        "#e74c3c",
        "#3498db",
        "#2ecc71",
        "#f1c40f",
        "#9b59b6",
        "#e67e22"
    ];

    cy.nodes().forEach(node => {
        const usedColors = [];

        node.neighborhood("node").forEach(neighbor => {
            if(neighbor.data("color")){
                usedColors.push(neighbor.data("color"));
            }
        });

        for(let color of colors){
            if(!usedColors.includes(color)){
                node.data("color", color);
                break;
            }
        }
    });
}

function showDetails(person){
    const personData = socialData[person];

    if(!personData){
        document.getElementById("details").innerHTML =
            "No saved data for " + person;
        return;
    }

    const platforms = personData.platforms || [];

    let html = `
        <h3>${person}</h3>
        <b>Saved Data / Platforms:</b>
    `;

    if(platforms.length === 0){
        html += `<p>No saved platforms/data.</p>`;
    }else{
        html += `
            <div>
                ${platforms.map(item => `<span class="data-chip">${item}</span>`).join("")}
            </div>
        `;
    }

    html += `
        <hr>
        <b>Connections in Current Graph:</b>
    `;

    const connections = [];

    currentGroup.forEach(otherPerson => {
        if(otherPerson === person){
            return;
        }

        const shared = getSharedPlatforms(person, otherPerson);

        if(shared.length > 0){
            connections.push({
                name:otherPerson,
                shared:shared
            });
        }
    });

    if(connections.length === 0){
        html += `<p>This person is isolated in the current graph.</p>`;
    }else{
        connections.forEach(connection => {
            html += `
                <p>
                    <b>${connection.name}</b><br>
                    Same data/platform: ${connection.shared.join(", ")}
                </p>
            `;
        });
    }

    document.getElementById("details").innerHTML = html;
}

function searchPerson(){
    const searchValue = normalizeName(
        document.getElementById("searchName").value
    );

    if(!searchValue){
        alert("Enter a name.");
        return;
    }

    const realPerson = findPersonKey(searchValue);

    if(!realPerson){
        cy.elements().remove();

        document.getElementById("details").innerHTML =
            "Person not found: " + searchValue;

        return;
    }

    buildSinglePersonGraph(realPerson);
}

cy.on("tap","node",function(evt){
    const node = evt.target;
    const name = node.data("label");

    if(selectedNodeId === node.id()){
        cy.nodes().removeClass("highlighted");
        selectedNodeId = null;

        document.getElementById("details").innerHTML =
            "Click a person to view connections.";
    }else{
        selectedNodeId = node.id();

        cy.nodes().removeClass("highlighted");

        node.addClass("highlighted");
        node.neighborhood("node").addClass("highlighted");

        selectedPerson = name;
        renderPeopleSelector();
        showDetails(name);
    }
});

cy.on("tap","edge",function(evt){
    const edge = evt.target;

    document.getElementById("details").innerHTML = `
        <h3>${edge.source().data("label")} ↔ ${edge.target().data("label")}</h3>
        <b>Shared Data / Platforms:</b>
        <p>${edge.data("sharedLabel")}</p>
    `;
});

cy.on("tap",function(evt){
    if(evt.target === cy){
        cy.nodes().removeClass("highlighted");
        selectedNodeId = null;
    }
});

function toggleMenu(){
    const menu = document.getElementById("sideMenu");

    menu.style.display =
        menu.style.display === "block" ? "none" : "block";
}

function closeMenu(){
    document.getElementById("sideMenu").style.display = "none";
}

function toggleSocialFolder(){
    const folder = document.getElementById("socialFolder");
    const arrow = document.getElementById("folderArrow");

    if(folder.style.display === "block"){
        folder.style.display = "none";
        arrow.innerHTML = "▶";
    }else{
        folder.style.display = "block";
        arrow.innerHTML = "▼";
    }
}

function loadSocialFolders(){
    const folder = document.getElementById("socialFolder");
    folder.innerHTML = "";

    Object.keys(socialData).sort().forEach(person => {
        const row = document.createElement("div");
        row.className = "folder-row";

        const item = document.createElement("div");
        item.className = "folder folder-name";
        item.innerHTML = "📁 " + person + "'s Data";

        item.onclick = function(){
            buildSinglePersonGraph(person);
            closeMenu();
        };

        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-folder";
        deleteButton.innerHTML = "🗑️";

        deleteButton.onclick = async function(event){
            event.stopPropagation();
            await deletePerson(person);
        };

        row.appendChild(item);
        row.appendChild(deleteButton);
        folder.appendChild(row);
    });
}

async function deletePerson(person){
    const confirmDelete =
        confirm("Delete " + person + "'s saved data?");

    if(!confirmDelete){
        return;
    }

    delete socialData[person];

    await deleteDoc(doc(db,"people",person));

    currentGroup = currentGroup.filter(name => name !== person);

    loadSocialFolders();
    renderPeopleSelector();
    buildCurrentGroupGraph();

    document.getElementById("details").innerHTML =
        person + "'s data deleted.";
}

async function resetData(){
    const confirmReset =
        confirm("Reset all database data?");

    if(!confirmReset){
        return;
    }

    const snapshot = await getDocs(collection(db,"people"));

    for(const document of snapshot.docs){
        await deleteDoc(doc(db,"people",document.id));
    }

    socialData = JSON.parse(JSON.stringify(defaultSocialData));

    await uploadDefaultData();

    currentGroup = [];
    selectedPerson = null;

    cy.elements().remove();

    loadSocialFolders();
    renderPeopleSelector();

    document.getElementById("details").innerHTML =
        "Default data loaded again.";
}

function clearSearchText(){
    document.getElementById("searchName").value = "";
    document.getElementById("clearSearch").style.display = "none";
}

document.getElementById("searchName")
.addEventListener("input",function(){
    document.getElementById("clearSearch").style.display =
        this.value.length > 0 ? "block" : "none";
});

document.getElementById("searchName")
.addEventListener("keydown",function(event){
    if(event.key === "Enter"){
        searchPerson();
    }
});

loadDatabase();
