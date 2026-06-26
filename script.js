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
                "line-color":"#777"
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

window.addPersonData = addPersonData;
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

function normalizePersonName(name){
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

async function loadDatabase(){
    const snapshot = await getDocs(collection(db,"people"));

    if(snapshot.empty){
        socialData = JSON.parse(JSON.stringify(defaultSocialData));
        await uploadDefaultData();
    }else{
        socialData = {};

        snapshot.forEach(document => {
            socialData[document.id] = document.data();
        });
    }

    loadSocialFolders();

    document.getElementById("details").innerHTML =
        "Search a person or open a saved social folder.";
}

async function uploadDefaultData(){
    for(let person in socialData){
        await setDoc(doc(db,"people",person), socialData[person]);
    }
}

async function savePerson(person){
    await setDoc(doc(db,"people",person), socialData[person]);
}

async function addPersonData(){
    const person = normalizePersonName(
        document.getElementById("mainPerson").value
    );

    const dataName = normalizePersonName(
        document.getElementById("connectedPerson").value
    );

    if(!person || !dataName){
        alert("Enter person and data/platform.");
        return;
    }

    const realPerson = findPersonKey(person) || person;

    if(!socialData[realPerson]){
        socialData[realPerson] = {
            data:[]
        };
    }

    if(!socialData[realPerson].data){
        socialData[realPerson].data = [];
    }

    if(!socialData[realPerson].data.includes(dataName)){
        socialData[realPerson].data.push(dataName);
    }

    await savePerson(realPerson);

    buildGraphFromSharedData();
    loadSocialFolders();

    document.getElementById("mainPerson").value = "";
    document.getElementById("connectedPerson").value = "";
}

function buildGraphFromSharedData(){
    cy.elements().remove();

    const people = Object.keys(socialData);
    const nodes = [];
    const edges = [];

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

            const dataA = socialData[personA].data || [];
            const dataB = socialData[personB].data || [];

            const sharedData = dataA.filter(item =>
                dataB.includes(item)
            );

            if(sharedData.length > 0){
                edges.push({
                    data:{
                        id:makeId(personA) + "_" + makeId(personB),
                        source:makeId(personA),
                        target:makeId(personB),
                        shared:sharedData.join(", ")
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
        "Graph generated based on shared data/platforms.";
}

function buildSinglePersonGraph(person){
    cy.elements().remove();

    if(!socialData[person]){
        document.getElementById("details").innerHTML =
            "No saved data for " + person;
        return;
    }

    const nodes = new Map();
    const edges = [];
    const personData = socialData[person].data || [];

    nodes.set(makeId(person), {
        data:{
            id:makeId(person),
            label:person
        }
    });

    for(let otherPerson in socialData){
        if(otherPerson === person){
            continue;
        }

        const otherData = socialData[otherPerson].data || [];

        const sharedData = personData.filter(item =>
            otherData.includes(item)
        );

        if(sharedData.length > 0){
            nodes.set(makeId(otherPerson), {
                data:{
                    id:makeId(otherPerson),
                    label:otherPerson
                }
            });

            edges.push({
                data:{
                    id:makeId(person) + "_" + makeId(otherPerson),
                    source:makeId(person),
                    target:makeId(otherPerson),
                    shared:sharedData.join(", ")
                }
            });
        }
    }

    cy.add([...nodes.values(), ...edges]);

    applyVertexColoring();

    cy.layout({
        name:"cose",
        animate:true,
        padding:50
    }).run();

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

    const dataList = personData.data || [];

    let html = `
        <h3>${person}</h3>
        <b>Saved Data / Platforms:</b>
        <ul>
            ${dataList.map(item => `<li>${item}</li>`).join("")}
        </ul>
        <hr>
        <b>Connected To:</b>
    `;

    const connectedPeople = [];

    for(let otherPerson in socialData){
        if(otherPerson === person){
            continue;
        }

        const otherData = socialData[otherPerson].data || [];

        const shared = dataList.filter(item =>
            otherData.includes(item)
        );

        if(shared.length > 0){
            connectedPeople.push({
                name:otherPerson,
                shared:shared
            });
        }
    }

    if(connectedPeople.length === 0){
        html += `<p>No matching data with other people.</p>`;
    }else{
        connectedPeople.forEach(connection => {
            html += `
                <p>
                    <b>${connection.name}</b><br>
                    Same data: ${connection.shared.join(", ")}
                </p>
            `;
        });
    }

    document.getElementById("details").innerHTML = html;
}

function searchPerson(){
    const searchValue = normalizePersonName(
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

        showDetails(name);
    }
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
        item.innerHTML = "📁 " + person + "'s Socials";

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

    loadSocialFolders();
    cy.elements().remove();

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

    loadSocialFolders();
    cy.elements().remove();

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