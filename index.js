window.qrCode = (function () {
	const DEFAULTS = {
		size: 512,
		border: 4,               // Quiet zone modules around the QR code
		imageMargin: 0,          // Margin (in modules or px) indented inside the QR code
		dotSize: 70,             // 30 to 100 (% of full cell size)
		dotRoundness: 0,         // 0 to 50
		dotStyle: "square",      // "square", "rounded", "dots", "classy"
		finderStyle: "square",   // "square", "rounded", "dot"
		finderRoundness: 0,
		errorLevel: "H",         // "H" is recommended when overlaying an image
		foreground: "#000000",
		background: "#ffffff",
		drawWhiteDots: true,     // Draw un-encoded (false) bits in white
		transparentBackground: false,
		bgOpacity: 0             // 0.0 (raw image) to 1.0 (tint overlay)
	};

	let bgImage = null;

	function clamp(value, min, max, fallback) {
		const n = Number(value);
		if (!Number.isFinite(n)) return fallback;
		return Math.min(max, Math.max(min, n));
	}

	function color(value, fallback) {
		return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value || "") ? value : fallback;
	}

	function normalize(opts) {
		const o = Object.assign({}, DEFAULTS, opts || {});
		return {
			size: Math.round(clamp(o.size, 64, 4096, DEFAULTS.size)),
			border: Math.round(clamp(o.border, 0, 20, DEFAULTS.border)),
			imageMargin: Math.round(clamp(o.imageMargin, 0, 10, DEFAULTS.imageMargin)),
			dotSize: clamp(o.dotSize, 20, 100, DEFAULTS.dotSize),
			dotRoundness: clamp(o.dotRoundness, 0, 50, DEFAULTS.dotRoundness) / 50,
			dotStyle: ["square", "rounded", "dots", "classy"].includes(o.dotStyle) ? o.dotStyle : DEFAULTS.dotStyle,
			finderStyle: ["square", "rounded", "dot"].includes(o.finderStyle) ? o.finderStyle : DEFAULTS.finderStyle,
			finderRoundness: clamp(o.finderRoundness, 0, 50, DEFAULTS.finderRoundness) / 50,
			errorLevel: ["L", "M", "Q", "H"].includes(o.errorLevel) ? o.errorLevel : DEFAULTS.errorLevel,
			foreground: color(o.foreground, DEFAULTS.foreground),
			background: color(o.background, DEFAULTS.background),
			drawWhiteDots: Boolean(o.drawWhiteDots),
			transparentBackground: Boolean(o.transparentBackground),
			bgOpacity: clamp(o.bgOpacity, 0, 1, DEFAULTS.bgOpacity)
		};
	}

	function loadImage(file) {
		return new Promise(function (resolve, reject) {
			const url = URL.createObjectURL(file);
			const img = new Image();

			img.onload = function () {
				URL.revokeObjectURL(url);
				resolve(img);
			};

			img.onerror = function () {
				URL.revokeObjectURL(url);
				reject(new Error("Image failed to load."));
			};

			img.src = url;
		});
	}

	function addRoundRect(ctx, x, y, w, h, radius) {
		radius = Math.min(radius, w / 2, h / 2);
		if (radius <= 0) {
			ctx.rect(x, y, w, h);
			return;
		}
		ctx.moveTo(x + radius, y);
		ctx.arcTo(x + w, y, x + w, y + h, radius);
		ctx.arcTo(x + w, y + h, x, y + h, radius);
		ctx.arcTo(x, y + h, x, y, radius);
		ctx.arcTo(x, y, x + w, y, radius);
		ctx.closePath();
	}

	function isFinder(row, col, count) {
		return (
			(row < 8 && col < 8) ||
			(row < 8 && col >= count - 8) ||
			(row >= count - 8 && col < 8)
		);
	}

	function drawFinder(ctx, x, y, cell, style, roundness, backgroundColor, isTransparent) {
		const size = 7 * cell;
		let outerR = size * roundness * 0.5;
		let middleR = 5 * cell * roundness * 0.5;
		let innerR = 3 * cell * roundness * 0.5;

		if (style === "rounded") {
			outerR = size * 0.35;
			middleR = 5 * cell * 0.35;
			innerR = 3 * cell * 0.35;
		} else if (style === "dot") {
			outerR = size * 0.5;
			middleR = 5 * cell * 0.5;
			innerR = 3 * cell * 0.5;
		}

		// Outer frame
		ctx.beginPath();
		addRoundRect(ctx, x, y, size, size, outerR);
		ctx.fill();

		// Cutout ring
		ctx.save();
		if (isTransparent) {
			ctx.globalCompositeOperation = "destination-out";
		} else {
			ctx.fillStyle = backgroundColor;
		}
		ctx.beginPath();
		addRoundRect(ctx, x + cell, y + cell, 5 * cell, 5 * cell, middleR);
		ctx.fill();
		ctx.restore();

		// Center core
		ctx.beginPath();
		addRoundRect(ctx, x + 2 * cell, y + 2 * cell, 3 * cell, 3 * cell, innerR);
		ctx.fill();
	}

	function drawModule(ctx, col, row, cell, dotSize, style, roundness) {
		const radius = (cell * (dotSize / 100)) / 2;
		const width = radius * 2;
		const height = radius * 2;
		const centerX = cell * (col + 0.5);
		const centerY = cell * (row + 0.5);
		const x = centerX - radius;
		const y = centerY - radius;

		ctx.beginPath();
		if (style === "dots") {
			ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
		} else {
			const cornerRadius = (Math.min(width, height) / 2) * (roundness > 0 ? roundness : 0);
			addRoundRect(ctx, x, y, width, height, cornerRadius);
		}
		ctx.fill();
	}

	function drawQrBoundBackground(ctx, image, offset, matrixSize, options, cell) {
		ctx.save();
		const marginPx = options.imageMargin * cell;
		const drawX = offset + marginPx;
		const drawY = offset + marginPx;
		const drawSize = Math.max(0, matrixSize - marginPx * 2);

		ctx.drawImage(image, drawX, drawY, drawSize, drawSize);

		if (!options.transparentBackground && options.bgOpacity > 0) {
			ctx.fillStyle = options.background;
			ctx.globalAlpha = options.bgOpacity;
			ctx.fillRect(drawX, drawY, drawSize, drawSize);
		}
		ctx.restore();
	}

	function buildModel(text, level) {
		if (typeof QRCode === "undefined") {
			throw new Error("QRCode library has not been loaded.");
		}

		const scratch = document.createElement("div");
		const qr = new QRCode(scratch, {
			width: 256,
			height: 256,
			correctLevel: QRCode.CorrectLevel[level]
		});

		qr.makeCode(text);

		if (!qr._oQRCode || !qr._oQRCode.modules) {
			throw new Error("The QR code model could not be created.");
		}

		return qr._oQRCode;
	}

	function draw(model, canvas, options) {
		const matrix = model.modules;
		const qrLength = matrix.length;
		const border = options.border;
		const totalModules = qrLength + border * 2;

		const cell = Math.max(1, Math.floor(options.size / totalModules));
		const canvasSize = cell * totalModules;
		const matrixSize = qrLength * cell;
		const offset = border * cell;

		canvas.width = canvasSize;
		canvas.height = canvasSize;

		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Canvas rendering is not supported.");

		// 1. Draw outer background
		if (options.transparentBackground) {
			ctx.clearRect(0, 0, canvasSize, canvasSize);
		} else {
			ctx.fillStyle = options.background;
			ctx.fillRect(0, 0, canvasSize, canvasSize);
		}

		// 2. Draw user-uploaded image with the inset margin applied
		if (bgImage) {
			drawQrBoundBackground(ctx, bgImage, offset, matrixSize, options, cell);
		}

		ctx.imageSmoothingEnabled = false;

		// 3. Draw Corner Finders
		const finderLocations = [
			{ row: 0, col: 0 },
			{ row: 0, col: qrLength - 7 },
			{ row: qrLength - 7, col: 0 }
		];

		for (const finder of finderLocations) {
			ctx.fillStyle = options.foreground;
			drawFinder(
				ctx,
				(finder.col + border) * cell,
				(finder.row + border) * cell,
				cell,
				options.finderStyle,
				options.finderRoundness,
				options.background,
				options.transparentBackground
			);
		}

		// 4. Draw QR Modules: dark bits use foreground, light bits always use #ffffff
		for (let row = 0; row < qrLength; row++) {
			for (let col = 0; col < qrLength; col++) {
				if (isFinder(row, col, qrLength)) continue;

				const isDark = matrix[row][col];

				if (!isDark && !options.drawWhiteDots) {
					continue;
				}

				// Always use pure white (#ffffff) for light modules
				ctx.fillStyle = isDark ? options.foreground : "#ffffff";

				drawModule(
					ctx,
					col + border,
					row + border,
					cell,
					options.dotSize,
					options.dotStyle,
					options.dotRoundness
				);
			}
		}

		return canvasSize;
	}

	function generate(elementId, text, opts) {
		try {
			const host = document.getElementById(elementId);
			if (!host) return "The QR code container was not found.";
			if (!text || !String(text).trim()) return "Enter a link to generate a QR code.";

			const options = normalize(opts);
			const level = bgImage ? "H" : options.errorLevel;
			const model = buildModel(String(text), level);
			const canvas = document.createElement("canvas");

			draw(model, canvas, options);

			canvas.setAttribute("role", "img");
			canvas.setAttribute("aria-label", "QR code for " + text);

			if (typeof host.replaceChildren === "function") {
				host.replaceChildren(canvas);
			} else {
				host.innerHTML = "";
				host.appendChild(canvas);
			}

			return null;
		} catch (err) {
			console.error("QR generation failed:", err);
			return err && err.message ? err.message : "The QR code could not be generated.";
		}
	}

	async function setImage(inputOrFile) {
		try {
			let file = inputOrFile;
			if (typeof inputOrFile === "string") {
				const input = document.getElementById(inputOrFile);
				file = input && input.files && input.files[0];
			} else if (inputOrFile && inputOrFile.target) {
				file = inputOrFile.target.files && inputOrFile.target.files[0];
			}

			if (!file) {
				bgImage = null;
				return null;
			}

			bgImage = await loadImage(file);
			return null;
		} catch (err) {
			console.error("QR image failed:", err);
			bgImage = null;
			return "Image could not be read.";
		}
	}

	function clearImage(inputId) {
		bgImage = null;
		if (inputId) {
			const input = document.getElementById(inputId);
			if (input) input.value = "";
		}
	}

	function download(elementId, fileName) {
		const host = document.getElementById(elementId);
		if (!host) return;

		const canvas = host.querySelector("canvas");
		if (!canvas) return;

		const link = document.createElement("a");
		link.download = fileName || "qr_image.png";
		link.href = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
		document.body.appendChild(link);
		link.click();
		link.remove();
	}

	return {
		generate,
		setImage,
		clearImage,
		download
	};
})();