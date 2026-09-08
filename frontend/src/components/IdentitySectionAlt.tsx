import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { ThreeDPaper } from './ThreeDPaper';

export function IdentitySectionAlt() {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-20%" });

  // Headline: "Designing Systems" right-aligned, "That Endure" left with x-offset
  // Both animate from bottom to top on scroll-in
  const headlineLines = [
    {
      text: "Designing Systems",
      wrapClass: "w-full overflow-hidden flex justify-end",
      textClass: "text-right",
      initial: { y: 80, opacity: 0 },
      animate: { y: 0, opacity: 1 },
      hidden: { y: 80, opacity: 0 },
    },
    {
      text: "That Endure",
      wrapClass: "w-full overflow-hidden flex justify-start ml-0",
      textClass: "text-left",
      initial: { y: 80, opacity: 0 },
      animate: { y: 0, opacity: 1 },
      hidden: { y: 80, opacity: 0 },
    },
  ];

  return (
    <section ref={containerRef} className="relative w-full min-h-screen bg-[#F5FAFF] overflow-hidden sm:py-0  py-20 flex flex-col justify-center">
      <div className="max-w-[1500px] mx-auto px-6 sm:px-10 lg:px-20 w-full z-10 flex flex-col min-h-[70vh] justify-between gap-16">
        
        {/* Top: Headline — Designing Systems right, That Endure left-offset */}
        <div className="w-full flex flex-col gap-0 mt-10 md:mt-0 pl-0 md:pl-[12vw] lg:pl-[22vw] xl:pl-[26vw]">
          {headlineLines.map((item, index) => (
            <div key={index} className={item.wrapClass}>
              <motion.h2
                initial={item.initial}
                animate={isInView ? item.animate : item.hidden}
                transition={{
                  duration: 1.1,
                  delay: 0.1 + index * 0.18,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className={`font-sans font-semibold text-[10vw] sm:text-[8vw] lg:text-[6vw] leading-[1.15] tracking-[-0.04em] text-[#10171c] ${item.textClass}`}
              >
                {item.text}
              </motion.h2>
            </div>
          ))}
        </div>

        {/* Bottom: Grid for Paragraph and Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 items-start w-full mt-10 md:mt-0">
          
          {/* Bottom Left: Paragraph — higher position */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
            className="w-full pb-4 pr-4 self-start"
          >
            <p className="text-[#3a4048] font-['Poppins'] text-base sm:text-lg leading-relaxed font-medium">
              I am a software engineer with a deep focus on crafting robust backend architectures, scalable data pipelines, and decentralized Web3 solutions that stand the test of time.
            </p>
          </motion.div>

          {/* Bottom Right: Media Card — lower position (panoramic ratio) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotate: 0 }}
            animate={isInView ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: 0, scale: 0.9, rotate: 0 }}
            transition={{ duration: 1, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="flex justify-start md:justify-end mt-4 md:mt-12 self-end w-full"
          >
            <motion.div
              whileHover={{ scale: 1.02, rotate: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="relative w-full aspect-[16/9] rounded-[2rem] overflow-hidden cursor-pointer"
            >
              <ThreeDPaper variant="original" />
            </motion.div>
          </motion.div>

        </div>

      </div>
    </section>
  );
}
