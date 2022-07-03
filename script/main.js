let vertexBuffer = null;
let indexBuffer = null;
let colorBuffer = null;

let indices = [];
let vertices = [];
let colors = [];
let color = [0.0, 0.5, 1, 1];

let lightPos = [4, 4, 8];
let shapePos = [];

let shapeN = 20;
let zoomRatio = 0.7;

let pressed = false;
let lastRotate = Date.now();
let doCoulomb = true;

function initShaderParameters(prg)
{
	prg.vertexPositionAttribute = glContext.getAttribLocation(prg, "aVertexPosition");
	glContext.enableVertexAttribArray(prg.vertexPositionAttribute);

	prg.colorAttribute = glContext.getAttribLocation(prg, "aColor");
	glContext.enableVertexAttribArray(prg.colorAttribute);

	prg.lightPosUniform = glContext.getUniformLocation(prg, "lightPos");
	prg.pointsTexUniform = glContext.getUniformLocation(prg, "pointsTex");
	prg.pointsSizeUniform = glContext.getUniformLocation(prg, "pointsSize");
	prg.zoomUniform = glContext.getUniformLocation(prg, "zoom");
}

function initBuffers()
{
	indices = [];
	vertices = [];
	colors = [];

	indices.push(0, 1, 3, 2);

	colors.push(...color, ...color, ...color, ...color);

	vertices.push(-1, -1, 0,
				   1, -1, 0,
				   1,  1, 0,
				  -1,  1, 0);

	vertexBuffer = getVertexBufferWithVertices(vertices);
	indexBuffer = getIndexBufferWithIndices(indices);
	colorBuffer = getVertexBufferWithVertices(colors);
}

function createDataTexture(data)
{
	const tex = glContext.createTexture();
	glContext.bindTexture(glContext.TEXTURE_2D, tex);

	glContext.texImage2D(glContext.TEXTURE_2D, 0, glContext.RGBA, 
			data.length / 4, 1, 0, glContext.RGBA, glContext.FLOAT,
			new Float32Array(data));

	glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_S, glContext.CLAMP_TO_EDGE);
	glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_T, glContext.CLAMP_TO_EDGE);
	glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MIN_FILTER, glContext.NEAREST);
	glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MAG_FILTER, glContext.NEAREST);

	return tex;
}

function drawScene()
{
	glContext.clearColor(0.9, 0.9, 1, 1);
	glContext.enable(glContext.DEPTH_TEST);
	glContext.clear(glContext.COLOR_BUFFER_BIT | glContext.DEPTH_BUFFER_BIT);

	glContext.viewport(0, 0, c_width, c_height);
	glContext.bindBuffer(glContext.ARRAY_BUFFER, vertexBuffer);
	glContext.vertexAttribPointer(prg.vertexPositionAttribute, 3, glContext.FLOAT, false, 0, 0);
	
	glContext.bindBuffer(glContext.ARRAY_BUFFER, colorBuffer);
	glContext.vertexAttribPointer(prg.colorAttribute, 4, glContext.FLOAT, false, 0, 0);

	glContext.bindBuffer(glContext.ELEMENT_ARRAY_BUFFER, indexBuffer);
	glContext.drawElements(glContext.TRIANGLE_STRIP, indices.length, glContext.UNSIGNED_SHORT, 0);

	glContext.uniform3fv(prg.lightPosUniform, lightPos);

	const tex = createDataTexture(shapePos);
	glContext.activeTexture(glContext.TEXTURE0);
	glContext.bindTexture(glContext.TEXTURE_2D, tex);
	glContext.uniform1i(prg.pointsTexUniform, 0);

	glContext.uniform1i(prg.pointsSizeUniform, shapePos.length / 4);
	glContext.uniform1f(prg.zoomUniform, zoomRatio);
}

function initWebGL()
{
	glContext = getGLContext("webgl-canvas");
	glContext.getExtension("OES_texture_float");
	
	initProgram();
	initBuffers();
	initShapePos(shapeN);
	renderLoop();
}

function initShapePos(n)
{
	shapePos = [];
	phi = Math.PI * (3 - Math.sqrt(5));

	for (let i = 0; i < n; ++i)
	{
		let z = 1 - 2 * i / (n - 1)
		let r = Math.sqrt(1 - z * z);

		let theta = phi * i;
		let x = r * Math.cos(theta);
		let y = r * Math.sin(theta);

		shapePos.push(x);
		shapePos.push(y);
		shapePos.push(z);
		shapePos.push(0);
	}
}

function applyCoulomb()
{
	if (!doCoulomb)
	{
		return;
	}

	newShapePos = [];

	for (let i = 0; i < shapePos.length; i += 4)
	{
		let newX = shapePos[i];
		let newY = shapePos[i + 1];
		let newZ = shapePos[i + 2];

		for (let j = 0; j < shapePos.length; j += 4)
		{
			if (j != i)
			{
				vecX = shapePos[i] - shapePos[j];
				vecY = shapePos[i + 1] - shapePos[j + 1];
				vecZ = shapePos[i + 2] - shapePos[j + 2];

				let norm = vecX * vecX + vecY * vecY + vecZ * vecZ;

				newX += vecX / norm;
				newY += vecY / norm;
				newZ += vecZ / norm;
			}
		}

		let length = Math.sqrt(newX * newX + newY * newY + newZ * newZ);
		
		newShapePos.push(newX / length);
		newShapePos.push(newY / length);
		newShapePos.push(newZ / length);
		newShapePos.push(0);
	}

	shapePos = newShapePos;
}

function rotateY(angle)
{
	for (let i = 0; i < shapePos.length; i += 4)
	{
		let x = shapePos[i + 0]
		let z = shapePos[i + 2]

		shapePos[i + 0] = x * Math.cos(angle) - z * Math.sin(angle);
		shapePos[i + 2] = x * Math.sin(angle) + z * Math.cos(angle);
	}
}

function rotateX(angle)
{
	for (let i = 0; i < shapePos.length; i += 4)
	{
		let y = shapePos[i + 1]
		let z = shapePos[i + 2]

		shapePos[i + 1] = y * Math.cos(angle) - z * Math.sin(angle);
		shapePos[i + 2] = y * Math.sin(angle) + z * Math.cos(angle);
	}
}

function move(event)
{
	if (pressed)
	{
		let mouseScale = 0.005 * zoomRatio;
		rotateX(event.movementY * mouseScale);
		rotateY(-event.movementX * mouseScale);
	}
}

function rotate()
{
	let now = Date.now();

	if (!pressed)
	{
		rotateY(-0.0001 * (now - lastRotate));
	}

	lastRotate = now;
}

function zoom(event)
{
	let delta = Math.sign(event.deltaY);
	
	if (delta > 0)
	{
		zoomRatio /= 0.9;
	}
	else
	{
		zoomRatio *= 0.9;
	}

    zoomRatio = Math.min(zoomRatio, 4);
    zoomRatio = Math.max(zoomRatio, 0.1);

	event.preventDefault();
}

function setShapeN()
{
	shapeN = parseFloat(document.getElementById("slider-shape").value);
	document.getElementById("shape-n").innerText  = "Nombre de faces : " + shapeN;
	initShapePos(shapeN);
}

function hexToRGB(hex)
{
    let r = "0x" + hex[1] + hex[2];
    let g = "0x" + hex[3] + hex[4];
    let b = "0x" + hex[5] + hex[6];

    return {r: +r, g: +g, b: +b}
}

function setColor()
{
    let rgb = hexToRGB(document.getElementById("color-picker").value);
    color = [rgb.r / 255, rgb.g / 255, rgb.b / 255, 1];
    initBuffers();
}

window.onload = function()
{
	document.getElementById("webgl-canvas").addEventListener("mousemove", move);
	document.addEventListener("mousedown", () => {pressed = true});
	document.addEventListener("mouseup", () => {pressed = false});
	document.getElementById("webgl-canvas").addEventListener("wheel", zoom, false);

	let checkbox = document.getElementById("checkbox-coulomb");
	checkbox.onchange = e => {doCoulomb = e.currentTarget.checked}

	document.getElementById("slider-shape").onchange = setShapeN;
    document.getElementById("color-picker").onchange = setColor;
	window.setInterval(applyCoulomb, 1);
	window.setInterval(rotate, 16);

	initWebGL();
}