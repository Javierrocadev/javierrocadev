import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import { navigate } from "astro:transitions/client";
if (typeof document !== "undefined") {
    let cleanupMenu = () => {};
    let finishMenuNavigation = null;
    let isMenuNavigationPending = false;

    function initializeMenu() {
        cleanupMenu();
        if (!document.querySelector(".menu-toggle-btn")) return;
        const controller = new AbortController();
        let timeline;
        let rafId;
        gsap.registerPlugin(CustomEase, SplitText);
        CustomEase.create("hop", ".87,0,.13,1");
      
        const lenis = new Lenis();
        function raf(time) {
          lenis.raf(time);
          rafId = requestAnimationFrame(raf);
        }
        rafId = requestAnimationFrame(raf);
      
        const textContainers = document.querySelectorAll(".menu-col");
        let splitTextByContainer = [];
      
        textContainers.forEach((container) => {
          const textElements = container.querySelectorAll("a, p:not([data-no-split])");
          let containerSplits = [];
      
          textElements.forEach((element) => {
            const split = SplitText.create(element, {
              type: "lines",
              mask: "lines",
              linesClass: "line",
            });
            containerSplits.push(split);
      
            gsap.set(split.lines, { y: "-110%" });
          });
      
          splitTextByContainer.push(containerSplits);
        });
      
        const container = document.getElementById("page-content");
        const menuToggleBtn = document.querySelector(".menu-toggle-btn");
        const menuOverlay = document.querySelector(".menu-overlay");
        const menuOverlayContainer = document.querySelector(".menu-overlay-content");
        const menuMediaWrapper = document.querySelector(".menu-media-wrapper");
        const copyContainers = document.querySelectorAll(".menu-col");
        const menuToggleLabel = document.querySelector(".menu-toggle-label p");
        const hamburgerIcon = document.querySelector(".menu-hamburger-icon");
      
        let isMenuOpen = false;
        let isAnimating = false;

        function closeMenu(pageContainer = container, onComplete) {
          isAnimating = true;
          hamburgerIcon.classList.remove("active");

          // La página de destino empieza debajo del menú y sube siguiéndolo.
          if (pageContainer) gsap.set(pageContainer, { y: "100dvh" });

          const tl = timeline = gsap.timeline();

          tl.to(pageContainer, {
            y: "0dvh",
            duration: 1,
            ease: "hop",
          })
            .to(
              menuOverlay,
              {
                clipPath: "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)",
                duration: 1,
                ease: "hop",
              },
              "<"
            )
            .to(
              menuOverlayContainer,
              {
                yPercent: -50,
                duration: 1,
                ease: "hop",
              },
              "<"
            )
            .to(
              menuToggleLabel,
              {
                y: "0%",
                duration: 1,
                ease: "hop",
              },
              "<"
            )
            .to(
              copyContainers,
              {
                opacity: 0.25,
                duration: 1,
                ease: "hop",
              },
              "<"
            );

          tl.call(() => {
            splitTextByContainer.forEach((containerSplits) => {
              const copyLines = containerSplits.flatMap((split) => split.lines);
              gsap.set(copyLines, { y: "-110%" });
            });

            gsap.set(copyContainers, { opacity: 1 });
            gsap.set(menuMediaWrapper, { opacity: 0 });

            isAnimating = false;
            isMenuOpen = false;
            lenis.start();
            onComplete?.();
          });
        }

        finishMenuNavigation = (onComplete) => {
          const destinationContainer = document.getElementById("page-content");
          closeMenu(destinationContainer, onComplete);
        };
      
        menuToggleBtn.addEventListener("click", () => {

          if (isAnimating) return;
      
          if (!isMenuOpen) {
            isAnimating = true;
      
            lenis.stop();
      
            const tl = timeline = gsap.timeline();
      
            tl.to(
              menuToggleLabel,
              {
                y: "-110%",
                duration: 1,
                ease: "hop",
              },
              "<"
            )
              .to(
                container,
                {
                  y: "100dvh",
                  duration: 1,
                  ease: "hop",
                },
                "<"
              )
              .to(
                menuOverlay,
                {
                  clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
                  duration: 1,
                  ease: "hop",
                },
                "<"
              )
              .to(
                menuOverlayContainer,
                {
                  yPercent: 0,
                  duration: 1,
                  ease: "hop",
                },
                "<"
              )
              .to(
                menuMediaWrapper,
                {
                  opacity: 1,
                  duration: 0.75,
                  ease: "power2.out",
                  delay: 0.5,
                },
                "<"
              );
      
            splitTextByContainer.forEach((containerSplits) => {
              const copyLines = containerSplits.flatMap((split) => split.lines);
              tl.to(
                copyLines,
                {
                  y: "0%",
                  duration: 2,
                  ease: "hop",
                  stagger: -0.075,
                },
                -0.15
              );
            });
      
            hamburgerIcon.classList.add("active");
      
            tl.call(() => {
              isAnimating = false;
            });
      
            isMenuOpen = true;
          } else {
            closeMenu();
          }
        }, { signal: controller.signal });

        function resetMenu() {
          timeline?.kill();
          if (container) gsap.set(container, { clearProps: "transform" });
          gsap.set(menuOverlay, { clipPath: "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)" });
          gsap.set(menuOverlayContainer, { yPercent: -50 });
          gsap.set(menuToggleLabel, { y: "0%" });
          gsap.set(copyContainers, { opacity: 1 });
          gsap.set(menuMediaWrapper, { opacity: 0 });
          splitTextByContainer.flat().forEach(split => gsap.set(split.lines, { y: "-110%" }));
          hamburgerIcon.classList.remove("active");
          isMenuOpen = false;
          isAnimating = false;
          lenis.start();
        }

        menuOverlay.addEventListener("click", async (event) => {
          const link = event.target.closest("a[href]");
          if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          if (link.target && link.target !== "_self") return;

          const destination = new URL(link.href, window.location.href);
          if (destination.origin !== window.location.origin) return;

          event.preventDefault();

          if (isAnimating) {
            timeline?.progress(1);
          }

          if (destination.href === window.location.href) {
            closeMenu();
            return;
          }

          isMenuNavigationPending = true;
          try {
            await navigate(destination.href);
          } catch (error) {
            isMenuNavigationPending = false;
            resetMenu();
            throw error;
          }
        }, { signal: controller.signal });

        cleanupMenu = () => {
          controller.abort();
          resetMenu();
          cancelAnimationFrame(rafId);
          lenis.destroy();
          splitTextByContainer.flat().forEach(split => split.revert());
          finishMenuNavigation = null;
          cleanupMenu = () => {};
        };
      }
      document.addEventListener("astro:page-load", () => {
        if (isMenuNavigationPending && finishMenuNavigation) {
          finishMenuNavigation(() => {
            isMenuNavigationPending = false;
            cleanupMenu();
            initializeMenu();
          });
          return;
        }

        initializeMenu();
      });
      document.addEventListener("astro:before-swap", () => {
        if (!isMenuNavigationPending) cleanupMenu();
      });
}
