const svg = document.getElementById("mandala");
const colorPicker = document.getElementById("colorPicker");
const backgroundPicker = document.getElementById("backgroundPicker");
const fillToggle = document.getElementById("fillToggle");
const glowToggle = document.getElementById("glowToggle");

const SVG_NS = "http://www.w3.org/2000/svg";
const CENTER_X = 400;
const CENTER_Y = 400;
const DEFAULT_MOTIF_SPACING = 32;
const MIN_MOTIFS_PER_RING = 18;
const MAX_MOTIFS_PER_RING = 96;
const MOTIF_SPACING = {
    "long-petal": 52,
    "line-sprout": 42,
    "dot-line": 40,
    "small-arch": 46,
    "wave": 48,
    "arc-band": 48,
    "swirl": 38,
    "spiral": 46,
    "cluster": 42,
    "bead-link": 48,
    "chevron": 38,
    "hatch-triangle": 42,
    "stripe-block": 40,
    "eye": 44,
    "sunburst": 42,
    "star": 34,
    "teardrop": 34,
    "pointed-petal": 36,
    "leaf": 32,
    "triangle": 34,
    "diamond": 34,
    "circle": 30,
    "ring-dot": 34,
    "crescent": 38
};

let currentRadius = 50;
let eraserMode = false;
let invertElementMode = false;
const actionHistory = [];
const removedActions = [];

const defs = createSvgElement("defs", {});
const glowFilter = createSvgElement("filter", {
    id: "glow",
    x: "-50%",
    y: "-50%",
    width: "200%",
    height: "200%"
});
const blur = createSvgElement("feGaussianBlur", {
    stdDeviation: 4,
    result: "coloredBlur"
});
const merge = createSvgElement("feMerge", {});
const glowMerge = createSvgElement("feMergeNode", {
    in: "coloredBlur"
});
const shapeMerge = createSvgElement("feMergeNode", {
    in: "SourceGraphic"
});

merge.appendChild(glowMerge);
merge.appendChild(shapeMerge);
glowFilter.appendChild(blur);
glowFilter.appendChild(merge);
defs.appendChild(glowFilter);
svg.appendChild(defs);

const backgroundRect = createSvgElement("rect", {
    x: 0,
    y: 0,
    width: 800,
    height: 800,
    fill: backgroundPicker.value
});

svg.appendChild(backgroundRect);
backgroundPicker.addEventListener("input", () => {
    backgroundRect.setAttribute("fill", backgroundPicker.value);
});

function createSvgElement(tag, attributes) {
    const element = document.createElementNS(SVG_NS, tag);

    Object.entries(attributes).forEach(([name, value]) => {
        element.setAttribute(name, value);
    });

    return element;
}

function polygonPoints(points) {
    return points.map(([x, y]) => `${x},${y}`).join(" ");
}

function starPoints(cx, cy, outerRadius, innerRadius, points = 5) {
    const coords = [];

    for (let i = 0; i < points * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = -Math.PI / 2 + (i * Math.PI) / points;

        coords.push([
            cx + radius * Math.cos(angle),
            cy + radius * Math.sin(angle)
        ]);
    }

    return polygonPoints(coords);
}

function getCurrentStyle(canFill = true) {
    const color = colorPicker.value;
    const shouldFill = canFill && fillToggle.checked;
    const style = {
        fill: shouldFill ? color : "none",
        stroke: color,
        "stroke-width": 2
    };

    if (glowToggle.checked) {
        style.filter = "url(#glow)";
    }

    return style;
}

function styleAttributes(extraAttributes = {}, canFill = true) {
    return {
        ...getCurrentStyle(canFill),
        ...extraAttributes
    };
}

function recordAction(action) {
    actionHistory.push(action);
    removedActions.length = 0;
}

function updateEraserMode() {
    document.body.classList.toggle("eraser-mode", eraserMode);
}

function updateInvertElementMode() {
    document.body.classList.toggle("invert-element-mode", invertElementMode);
}

function removeActionAt(index) {
    const action = actionHistory.splice(index, 1)[0];

    if (!action) {
        return;
    }

    action.removedFromEnd = index === actionHistory.length;
    action.element.remove();
    removedActions.push(action);

    if (action.removedFromEnd) {
        currentRadius = action.previousRadius;
    }
}

function removeLastOfType(type) {
    const index = actionHistory.map(action => action.type).lastIndexOf(type);

    if (index === -1) {
        return;
    }

    removeActionAt(index);
}

function findActionIndexByElement(element) {
    return actionHistory.findIndex(action => action.element === element);
}

function getActionGroup(element) {
    let currentElement = element;

    while (currentElement && currentElement !== svg) {
        if (currentElement.getAttribute("data-action")) {
            return currentElement;
        }

        currentElement = currentElement.parentNode;
    }

    return null;
}

function invertHexColor(color) {
    const trimmedColor = color.trim();

    if (!trimmedColor.startsWith("#")) {
        return trimmedColor;
    }

    const hex = trimmedColor.slice(1);
    const fullHex = hex.length === 3
        ? hex.split("").map(character => character + character).join("")
        : hex;

    if (fullHex.length !== 6) {
        return trimmedColor;
    }

    const inverted = (0xFFFFFF ^ parseInt(fullHex, 16))
        .toString(16)
        .padStart(6, "0");

    return `#${inverted}`;
}

function invertElementColors(actionGroup) {
    const elements = [actionGroup, ...actionGroup.querySelectorAll("*")];

    elements.forEach(element => {
        ["fill", "stroke"].forEach(attribute => {
            const color = element.getAttribute(attribute);

            if (color && color !== "none") {
                element.setAttribute(attribute, invertHexColor(color));
            }
        });
    });
}

function motifGroup(children) {
    const group = createSvgElement("g", {});

    children.forEach(child => group.appendChild(child));

    return group;
}

function tangentRotation(angle, x, y) {
    return `rotate(${angle + 90} ${x} ${y})`;
}

function getMotifCount(radius, type) {
    const circumference = 2 * Math.PI * radius;
    const spacing = MOTIF_SPACING[type] || DEFAULT_MOTIF_SPACING;
    const count = Math.floor(circumference / spacing);

    return Math.max(MIN_MOTIFS_PER_RING, Math.min(MAX_MOTIFS_PER_RING, count));
}

function drawMotif(type, x, y, angle) {
    let motif;

    if (type === "circle") {
        motif = createSvgElement("circle", styleAttributes({
            cx: x,
            cy: y,
            r: 10
        }));
    }

    if (type === "triangle") {
        motif = createSvgElement("polygon", styleAttributes({
            points: polygonPoints([
                [x, y - 16],
                [x - 12, y + 12],
                [x + 12, y + 12]
            ]),
            transform: `rotate(${angle + 90} ${x} ${y})`
        }));
    }

    if (type === "long-petal") {
        motif = createSvgElement("path", styleAttributes({
            d: [
                `M ${x - 23} ${y}`,
                `C ${x - 10} ${y - 13}, ${x + 10} ${y - 13}, ${x + 23} ${y}`,
                `C ${x + 10} ${y + 13}, ${x - 10} ${y + 13}, ${x - 23} ${y}`,
                "Z"
            ].join(" "),
            transform: tangentRotation(angle, x, y)
        }));
    }

    if (type === "leaf") {
        motif = createSvgElement("ellipse", styleAttributes({
            cx: x,
            cy: y,
            rx: 8,
            ry: 18,
            transform: `rotate(${angle} ${x} ${y})`
        }));
    }

    if (type === "diamond") {
        motif = createSvgElement("polygon", styleAttributes({
            points: polygonPoints([
                [x, y - 18],
                [x + 10, y],
                [x, y + 18],
                [x - 10, y]
            ]),
            transform: `rotate(${angle} ${x} ${y})`
        }));
    }

    if (type === "pointed-petal") {
        motif = createSvgElement("path", styleAttributes({
            d: [
                `M ${x} ${y - 24}`,
                `C ${x + 18} ${y - 8}, ${x + 14} ${y + 18}, ${x} ${y + 23}`,
                `C ${x - 14} ${y + 18}, ${x - 18} ${y - 8}, ${x} ${y - 24}`,
                "Z"
            ].join(" "),
            transform: `rotate(${angle} ${x} ${y})`
        }));
    }

    if (type === "dot") {
        motif = createSvgElement("circle", styleAttributes({
            cx: x,
            cy: y,
            r: 4
        }));
    }

    if (type === "line-sprout") {
        motif = motifGroup([
            createSvgElement("path", styleAttributes({
                d: `M ${x - 10} ${y + 13} V ${y - 8} M ${x} ${y + 13} V ${y - 18} M ${x + 10} ${y + 13} V ${y - 4}`,
                "stroke-linecap": "round"
            }, false)),
            createSvgElement("circle", styleAttributes({ cx: x - 10, cy: y - 8, r: 3 })),
            createSvgElement("circle", styleAttributes({ cx: x, cy: y - 18, r: 3 })),
            createSvgElement("circle", styleAttributes({ cx: x + 10, cy: y - 4, r: 3 }))
        ]);
        motif.setAttribute("transform", tangentRotation(angle, x, y));
    }

    if (type === "dot-line") {
        motif = motifGroup([
            createSvgElement("path", styleAttributes({
                d: `M ${x - 20} ${y + 3} Q ${x} ${y - 8} ${x + 20} ${y + 3}`,
                "stroke-linecap": "round"
            }, false)),
            createSvgElement("circle", styleAttributes({ cx: x - 12, cy: y, r: 3 })),
            createSvgElement("circle", styleAttributes({ cx: x, cy: y - 4, r: 3 })),
            createSvgElement("circle", styleAttributes({ cx: x + 12, cy: y, r: 3 }))
        ]);
        motif.setAttribute("transform", tangentRotation(angle, x, y));
    }

    if (type === "star") {
        motif = createSvgElement("polygon", styleAttributes({
            points: starPoints(x, y, 16, 7),
            transform: `rotate(${angle + 90} ${x} ${y})`
        }));
    }

    if (type === "arch") {
        motif = createSvgElement("path", styleAttributes({
            d: `M ${x - 18} ${y + 14} Q ${x} ${y - 24} ${x + 18} ${y + 14}`,
            transform: `rotate(${angle} ${x} ${y})`
        }, false));
    }

    if (type === "small-arch") {
        motif = createSvgElement("path", styleAttributes({
            d: `M ${x - 24} ${y + 12} C ${x - 22} ${y - 6}, ${x - 10} ${y - 6}, ${x - 8} ${y + 12} C ${x - 6} ${y - 7}, ${x + 6} ${y - 7}, ${x + 8} ${y + 12} C ${x + 10} ${y - 6}, ${x + 22} ${y - 6}, ${x + 24} ${y + 12}`,
            "stroke-linecap": "round",
            transform: tangentRotation(angle, x, y)
        }, false));
    }

    if (type === "spike") {
        motif = createSvgElement("path", styleAttributes({
            d: `M ${x - 14} ${y + 16} L ${x} ${y - 22} L ${x + 14} ${y + 16}`,
            transform: `rotate(${angle} ${x} ${y})`
        }, false));
    }

    if (type === "wave") {
        motif = createSvgElement("path", styleAttributes({
            d: `M ${x - 24} ${y + 4} C ${x - 17} ${y - 9}, ${x - 10} ${y - 9}, ${x - 4} ${y + 4} C ${x + 2} ${y + 17}, ${x + 11} ${y + 17}, ${x + 18} ${y + 4} C ${x + 21} ${y - 2}, ${x + 23} ${y - 4}, ${x + 24} ${y - 4}`,
            "stroke-linecap": "round",
            transform: tangentRotation(angle, x, y)
        }, false));
    }

    if (type === "arc-band") {
        motif = motifGroup([
            createSvgElement("path", styleAttributes({
                d: `M ${x - 20} ${y + 17} Q ${x} ${y - 25} ${x + 20} ${y + 17}`,
                transform: tangentRotation(angle, x, y)
            }, false)),
            createSvgElement("path", styleAttributes({
                d: `M ${x - 11} ${y + 17} Q ${x} ${y - 4} ${x + 11} ${y + 17}`,
                transform: tangentRotation(angle, x, y)
            }, false))
        ]);
    }

    if (type === "teardrop") {
        motif = createSvgElement("path", styleAttributes({
            d: [
                `M ${x} ${y - 22}`,
                `C ${x + 18} ${y - 4}, ${x + 12} ${y + 20}, ${x} ${y + 20}`,
                `C ${x - 12} ${y + 20}, ${x - 18} ${y - 4}, ${x} ${y - 22}`,
                "Z"
            ].join(" "),
            transform: `rotate(${angle + 90} ${x} ${y})`
        }));
    }

    if (type === "swirl") {
        motif = createSvgElement("path", styleAttributes({
            d: [
                `M ${x - 14} ${y}`,
                `C ${x - 14} ${y - 12}, ${x + 14} ${y - 12}, ${x + 14} ${y}`,
                `C ${x + 14} ${y + 10}, ${x - 4} ${y + 10}, ${x - 4} ${y}`,
                `C ${x - 4} ${y - 5}, ${x + 5} ${y - 5}, ${x + 5} ${y}`
            ].join(" "),
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
            transform: tangentRotation(angle, x, y)
        }, false));
    }

    if (type === "spiral") {
        motif = createSvgElement("path", styleAttributes({
            d: [
                `M ${x - 22} ${y + 8}`,
                `C ${x - 14} ${y - 14}, ${x + 17} ${y - 15}, ${x + 20} ${y + 5}`,
                `C ${x + 23} ${y + 22}, ${x - 3} ${y + 24}, ${x - 5} ${y + 7}`,
                `C ${x - 7} ${y - 4}, ${x + 8} ${y - 6}, ${x + 9} ${y + 3}`
            ].join(" "),
            "stroke-linecap": "round",
            transform: tangentRotation(angle, x, y)
        }, false));
    }

    if (type === "cluster") {
        motif = motifGroup([
            createSvgElement("circle", styleAttributes({ cx: x - 9, cy: y + 7, r: 7 })),
            createSvgElement("circle", styleAttributes({ cx: x + 9, cy: y + 7, r: 7 })),
            createSvgElement("circle", styleAttributes({ cx: x, cy: y - 10, r: 7 }))
        ]);
        motif.setAttribute("transform", tangentRotation(angle, x, y));
    }

    if (type === "bead-link") {
        motif = motifGroup([
            createSvgElement("path", styleAttributes({ d: `M ${x - 18} ${y} H ${x + 18}` }, false)),
            createSvgElement("circle", styleAttributes({ cx: x - 16, cy: y, r: 7 })),
            createSvgElement("circle", styleAttributes({ cx: x + 16, cy: y, r: 7 }))
        ]);
        motif.setAttribute("transform", tangentRotation(angle, x, y));
    }

    if (type === "chevron") {
        motif = createSvgElement("path", styleAttributes({
            d: `M ${x - 17} ${y - 9} L ${x} ${y + 11} L ${x + 17} ${y - 9}`,
            transform: tangentRotation(angle, x, y)
        }, false));
    }

    if (type === "hatch-triangle") {
        motif = motifGroup([
            createSvgElement("polygon", styleAttributes({
                points: polygonPoints([[x, y - 20], [x + 18, y + 16], [x - 18, y + 16]])
            })),
            createSvgElement("path", styleAttributes({
                d: `M ${x - 7} ${y + 16} L ${x + 7} ${y - 6} M ${x + 3} ${y + 16} L ${x + 13} ${y + 2}`
            }, false))
        ]);
        motif.setAttribute("transform", tangentRotation(angle, x, y));
    }

    if (type === "stripe-block") {
        motif = motifGroup([
            createSvgElement("rect", styleAttributes({
                x: x - 15,
                y: y - 15,
                width: 30,
                height: 30
            })),
            createSvgElement("path", styleAttributes({
                d: `M ${x - 5} ${y - 15} V ${y + 15} M ${x + 5} ${y - 15} V ${y + 15}`
            }, false))
        ]);
        motif.setAttribute("transform", tangentRotation(angle, x, y));
    }

    if (type === "crescent") {
        motif = createSvgElement("path", styleAttributes({
            d: [
                `M ${x + 11} ${y - 20}`,
                `C ${x - 11} ${y - 14}, ${x - 13} ${y + 15}, ${x + 10} ${y + 20}`,
                `C ${x - 8} ${y + 22}, ${x - 22} ${y + 11}, ${x - 22} ${y}`,
                `C ${x - 22} ${y - 13}, ${x - 8} ${y - 23}, ${x + 11} ${y - 20}`,
                "Z"
            ].join(" "),
            transform: `rotate(${angle} ${x} ${y})`
        }));
    }

    if (type === "eye") {
        motif = motifGroup([
            createSvgElement("path", styleAttributes({
                d: `M ${x - 21} ${y} Q ${x} ${y - 17} ${x + 21} ${y} Q ${x} ${y + 17} ${x - 21} ${y} Z`
            })),
            createSvgElement("circle", styleAttributes({ cx: x, cy: y, r: 4 }))
        ]);
        motif.setAttribute("transform", `rotate(${angle} ${x} ${y})`);
    }

    if (type === "ring-dot") {
        motif = motifGroup([
            createSvgElement("circle", styleAttributes({ cx: x, cy: y, r: 13 })),
            createSvgElement("circle", styleAttributes({ cx: x, cy: y, r: 4 }))
        ]);
    }

    if (type === "sunburst") {
        motif = motifGroup([
            createSvgElement("circle", styleAttributes({ cx: x, cy: y, r: 5 })),
            createSvgElement("path", styleAttributes({
                d: `M ${x} ${y - 22} V ${y - 12} M ${x} ${y + 12} V ${y + 22} M ${x - 22} ${y} H ${x - 12} M ${x + 12} ${y} H ${x + 22} M ${x - 15} ${y - 15} L ${x - 8} ${y - 8} M ${x + 8} ${y + 8} L ${x + 15} ${y + 15} M ${x + 15} ${y - 15} L ${x + 8} ${y - 8} M ${x - 8} ${y + 8} L ${x - 15} ${y + 15}`,
                "stroke-linecap": "round"
            }, false))
        ]);
        motif.setAttribute("transform", `rotate(${angle} ${x} ${y})`);
    }

    return motif;
}

function addRing(type) {
    const previousRadius = currentRadius;
    const nextRadius = currentRadius + 40;
    const motifCount = getMotifCount(currentRadius, type);
    const group = createSvgElement("g", {
        "data-action": type
    });

    for (let i = 0; i < motifCount; i++) {
        const angle = (360 / motifCount) * i;
        const rad = angle * Math.PI / 180;
        const x = CENTER_X + currentRadius * Math.cos(rad);
        const y = CENTER_Y + currentRadius * Math.sin(rad);
        const motif = drawMotif(type, x, y, angle);

        if (motif) {
            group.appendChild(motif);
        }
    }

    svg.appendChild(group);
    recordAction({
        type,
        element: group,
        previousRadius,
        nextRadius
    });

    currentRadius = nextRadius;
}

function addCenterDot() {
    const group = createSvgElement("g", {
        "data-action": "center-dot"
    });
    const outerDot = createSvgElement("circle", styleAttributes({
        cx: CENTER_X,
        cy: CENTER_Y,
        r: 12
    }));

    const innerDot = createSvgElement("circle", styleAttributes({
        cx: CENTER_X,
        cy: CENTER_Y,
        r: 5
    }));

    group.appendChild(outerDot);
    group.appendChild(innerDot);
    svg.appendChild(group);
    recordAction({
        type: "center-dot",
        element: group,
        previousRadius: currentRadius,
        nextRadius: currentRadius
    });
}

function addBoundary() {
    const previousRadius = currentRadius;
    const radius = Math.min(currentRadius, 380);
    const nextRadius = Math.min(radius + 30, 390);
    const group = createSvgElement("g", {
        "data-action": "boundary"
    });
    const boundary = createSvgElement("circle", styleAttributes({
        cx: CENTER_X,
        cy: CENTER_Y,
        r: radius,
        "stroke-width": 3
    }));

    group.appendChild(boundary);
    svg.appendChild(group);
    recordAction({
        type: "boundary",
        element: group,
        previousRadius,
        nextRadius
    });

    currentRadius = nextRadius;
}

function addDoubleBoundary() {
    const previousRadius = currentRadius;
    const radius = Math.min(currentRadius, 380);
    const nextRadius = Math.min(radius + 30, 390);
    const group = createSvgElement("g", {
        "data-action": "double-boundary"
    });
    const outerBoundary = createSvgElement("circle", styleAttributes({
        cx: CENTER_X,
        cy: CENTER_Y,
        r: radius,
        "stroke-width": 3
    }));
    const innerBoundary = createSvgElement("circle", styleAttributes({
        cx: CENTER_X,
        cy: CENTER_Y,
        r: Math.max(radius - 12, 1),
        "stroke-width": 3
    }));

    group.appendChild(outerBoundary);
    group.appendChild(innerBoundary);
    svg.appendChild(group);
    recordAction({
        type: "double-boundary",
        element: group,
        previousRadius,
        nextRadius
    });

    currentRadius = nextRadius;
}

function eraseLast() {
    eraserMode = !eraserMode;
    invertElementMode = false;
    updateEraserMode();
    updateInvertElementMode();
}

function toggleReverse() {
    removeActionAt(actionHistory.length - 1);
}

function toggleInverse() {
    const action = removedActions.pop();

    if (!action) {
        return;
    }

    svg.appendChild(action.element);
    actionHistory.push(action);

    if (action.removedFromEnd) {
        currentRadius = action.nextRadius;
    }
}

function toggleInvertElement() {
    invertElementMode = !invertElementMode;
    eraserMode = false;
    updateInvertElementMode();
    updateEraserMode();
}

function resetCanvas() {
    actionHistory.forEach(action => action.element.remove());
    removedActions.length = 0;
    actionHistory.length = 0;
    currentRadius = 50;
    eraserMode = false;
    invertElementMode = false;
    updateEraserMode();
    updateInvertElementMode();
}

function downloadArtwork() {
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", SVG_NS);

    const svgData = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgData], {
        type: "image/svg+xml;charset=utf-8"
    });
    const svgUrl = URL.createObjectURL(svgBlob);
    const image = new Image();

    image.onload = () => {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.width = 800;
        canvas.height = 800;
        context.fillStyle = backgroundPicker.value;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);

        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = url;
            link.download = "mandala-artwork.jpg";
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            URL.revokeObjectURL(svgUrl);
        }, "image/jpeg", 0.95);
    };

    image.src = svgUrl;
}

function downloadSvgArtwork() {
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", SVG_NS);

    const svgData = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgData], {
        type: "image/svg+xml;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "mandala-artwork.svg";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

svg.addEventListener("click", event => {
    if (!eraserMode && !invertElementMode) {
        return;
    }

    const actionGroup = getActionGroup(event.target);

    if (!actionGroup) {
        return;
    }

    if (eraserMode) {
        const index = findActionIndexByElement(actionGroup);
        removeActionAt(index);
        return;
    }

    invertElementColors(actionGroup);
});
