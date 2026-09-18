import { motion } from 'framer-motion';

export function PaperSemiCircle() {
  const papers = [
    { rotate: -40, zIndex: 1, translateY: 40, props: { title: "Backend Architecture", date: "Jan 10, 2024", studio: "Microservices", bgText: "BACKEND" } },
    { rotate: -20, zIndex: 2, translateY: 10, props: { title: "Data Pipelines", date: "May 22, 2025", studio: "Data Engineering", bgText: "DATA" } },
    { rotate: 0,   zIndex: 3, translateY: 0,  props: { title: "Dharu's Portfolio", date: "Feb 14, 2026", studio: "Nocturne Studio", bgText: "NOCTURNE" } },
    { rotate: 20,  zIndex: 2, translateY: 10, props: { title: "Web3 Solutions", date: "Nov 05, 2026", studio: "Decentralized", bgText: "WEB3" } },
    { rotate: 40,  zIndex: 1, translateY: 40, props: { title: "System Design", date: "Aug 18, 2027", studio: "Scalability", bgText: "SYSTEM" } },
  ];

  return (
    <section className="relative w-full py-32 bg-[#F5FAFF] overflow-hidden flex flex-col items-center justify-center">
      
      <div className="text-center mb-20 z-10">
        <h2 className="text-4xl md:text-5xl font-bold text-[#10171c] mb-4 tracking-tight">
          A Collection of Craft
        </h2>
        <p className="text-[#3a4048] max-w-lg mx-auto text-lg">
          Exploring variations of the 3D paper concept, arranged in a seamless semi-circle flow.
        </p>
      </div>

      <div className="relative flex justify-center items-end w-full max-w-[1000px] h-[400px] md:h-[500px]">
        {papers.map((item, i) => (
          <motion.div
            key={i}
            className="absolute bottom-0 origin-bottom"
            style={{
              width: '260px',
              aspectRatio: '3/4',
              zIndex: item.zIndex,
            }}
            initial={{ opacity: 0, rotate: 0, y: 200 }}
            whileInView={{ 
              opacity: 1, 
              rotate: item.rotate, 
              y: item.translateY 
            }}
            whileHover={{
              scale: 1.05,
              y: item.translateY - 20,
              zIndex: 10,
              transition: { duration: 0.3 }
            }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ 
              duration: 1.2, 
              delay: i * 0.1, 
              ease: [0.16, 1, 0.3, 1] 
            }}
          >
            <div className="w-full h-full rounded-[2rem] overflow-hidden shadow-2xl bg-[#08080a]" />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
