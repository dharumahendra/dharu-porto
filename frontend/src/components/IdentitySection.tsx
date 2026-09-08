import { motion } from 'framer-motion';

export function IdentitySection() {
  const roles = [
    "Software Developer",
    "DevOps Engineer",
    "Data Engineer",
    "AI/ML Enthusiast"
  ];

  return (
    <section className="relative w-full min-h-screen bg-[#F5FAFF] flex flex-col justify-center px-6 sm:px-10 lg:px-20 py-24 sm:py-32 overflow-hidden">
      
      {/* Abstract Animated Background Elements */}
      <motion.div 
        className="absolute -right-[10vw] top-[10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] border-[1px] border-[#10171c]/5 rounded-full pointer-events-none"
        animate={{ rotate: 360, scale: [1, 1.05, 1] }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
      />
      <motion.div 
        className="absolute -left-[10vw] bottom-[10%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] border-[1px] border-[#10171c]/5 rounded-full pointer-events-none"
        animate={{ rotate: -360, scale: [1, 1.1, 1] }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      />
      
      {/* A subtle grid overlay to match the tech/engineering vibe */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none"></div>

      <div className="max-w-[1400px] mx-auto w-full z-10 flex flex-col gap-16 md:gap-24">
        
        {/* Intro */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="h-[1px] w-12 bg-[#10171c]"></div>
            <p className="font-sans text-xs sm:text-sm md:text-base text-[#10171c] font-semibold tracking-[0.2em] uppercase">
              UGM Undergraduate • Information Technology
            </p>
          </div>
          
          <h2 className="font-sans font-bold text-3xl sm:text-5xl md:text-6xl lg:text-7xl text-[#10171c] leading-[1.1] tracking-tight max-w-5xl">
            I engineer solutions across the stack,{" "}
            <span className="text-[#9aa6ad]">
              turning complex data into seamless experiences.
            </span>
          </h2>
        </motion.div>

        {/* Roles List */}
        <div className="flex flex-col gap-2 sm:gap-4 lg:gap-6 pl-0 md:pl-16">
          {roles.map((role, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="group relative flex items-center w-fit"
            >
              <span className="font-sans font-bold text-4xl sm:text-6xl md:text-7xl lg:text-[100px] leading-none text-transparent [-webkit-text-stroke:1px_#10171c] md:[-webkit-text-stroke:2px_#10171c] group-hover:text-[#10171c] group-hover:[-webkit-text-stroke:0px] transition-all duration-300 cursor-default">
                {role}
              </span>
              <motion.div 
                className="absolute -left-8 md:-left-16 w-4 md:w-8 h-[2px] bg-[#10171c] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              />
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
