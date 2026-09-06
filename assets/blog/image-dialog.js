(() => {
  const images = Array.from(document.querySelectorAll(
    ".blog-hero img, .blog-card-visual img, .article-body figure img"
  ));

  if (images.length === 0) return;

  const dialog = document.createElement("dialog");
  dialog.className = "image-dialog";
  dialog.id = "blog-image-dialog";
  dialog.setAttribute("aria-labelledby", "image-dialog-title");

  const panel = document.createElement("div");
  panel.className = "image-dialog__panel";

  const closeButton = document.createElement("button");
  closeButton.className = "image-dialog__close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close image dialog");
  closeButton.textContent = "Close ×";

  const title = document.createElement("h2");
  title.id = "image-dialog-title";
  title.className = "image-dialog__title";
  title.textContent = "Image preview";

  const status = document.createElement("p");
  status.className = "image-dialog__status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  const dialogImage = document.createElement("img");
  dialogImage.className = "image-dialog__image";
  dialogImage.hidden = true;

  const caption = document.createElement("p");
  caption.className = "image-dialog__caption";
  caption.hidden = true;

  panel.append(closeButton, title, status, dialogImage, caption);
  dialog.append(panel);
  document.body.append(dialog);

  let returnFocus = null;
  let returnScrollY = 0;

  const imageDescription = (image) => {
    const alt = image.getAttribute("alt")?.trim();
    if (alt) return alt;

    const cardTitle = image.closest(".blog-card")?.querySelector("h2, h3")?.textContent.trim();
    if (cardTitle) return `Illustration for ${cardTitle}`;

    return "Research illustration";
  };

  const imageCaption = (image) => {
    const figureCaption = image.closest("figure")?.querySelector("figcaption")?.textContent.trim();
    return figureCaption || imageDescription(image);
  };

  const closeDialog = () => {
    if (dialog.open) dialog.close();
  };

  const openDialog = (image, trigger) => {
    returnFocus = trigger;
    returnScrollY = window.scrollY;

    const description = imageDescription(image);
    const captionText = imageCaption(image);
    title.textContent = description;
    dialogImage.setAttribute("alt", description);
    caption.textContent = captionText;
    caption.hidden = !captionText;
    status.textContent = "Loading image…";
    status.hidden = false;
    dialogImage.hidden = true;

    document.body.classList.add("has-image-dialog");
    dialog.showModal();
    dialogImage.src = image.currentSrc || image.src;
    closeButton.focus();
  };

  const bindTrigger = (trigger, image) => {
    if (!trigger || trigger.dataset.imageDialogTrigger === "true") return;

    trigger.dataset.imageDialogTrigger = "true";
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-controls", "blog-image-dialog");
    trigger.classList.add("image-dialog-trigger");
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      openDialog(image, trigger);
    });
  };

  images.forEach((image) => {
    const linkedTrigger = image.closest("a");

    if (linkedTrigger) {
      linkedTrigger.removeAttribute("aria-hidden");
      if (linkedTrigger.getAttribute("tabindex") === "-1") linkedTrigger.removeAttribute("tabindex");
      linkedTrigger.setAttribute("aria-label", `Open image: ${imageDescription(image)}`);
      bindTrigger(linkedTrigger, image);
    } else {
      image.setAttribute("role", "button");
      image.setAttribute("tabindex", "0");
      image.setAttribute("aria-label", `Open image: ${imageDescription(image)}`);
      bindTrigger(image, image);
      image.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openDialog(image, image);
      });
    }

    const figure = image.closest("figure");
    if (!figure) return;

    const imageUrl = new URL(image.getAttribute("src"), window.location.href).href;
    figure.querySelectorAll("a[href]").forEach((link) => {
      const linkUrl = new URL(link.getAttribute("href"), window.location.href).href;
      if (linkUrl === imageUrl) bindTrigger(link, image);
    });
  });

  dialogImage.addEventListener("load", () => {
    if (!dialog.open) return;
    status.hidden = true;
    status.textContent = "";
    dialogImage.hidden = false;
  });

  dialogImage.addEventListener("error", () => {
    if (!dialog.open) return;
    dialogImage.hidden = true;
    status.hidden = false;
    status.textContent = "This image could not be loaded. Close the preview and try again.";
  });

  closeButton.addEventListener("click", closeDialog);

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog();
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });

  dialog.addEventListener("close", () => {
    document.body.classList.remove("has-image-dialog");
    dialogImage.removeAttribute("src");
    dialogImage.hidden = true;
    status.textContent = "";
    caption.textContent = "";

    window.scrollTo(0, returnScrollY);
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  });
})();
