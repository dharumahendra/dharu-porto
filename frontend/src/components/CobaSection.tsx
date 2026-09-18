import { Navbar } from './Navbar';

/**
 * CobaSection — deliberately empty scratch page at /coba.
 *
 * Keeps only the navbar (so you can get back out) and a full-height container
 * to drop experiments into. Nothing else here on purpose.
 */
export function CobaSection() {
  return (
    <section className="relative w-full min-h-screen overflow-x-hidden bg-[#F5FAFF] flex flex-col">
      <Navbar />

      <div className="relative z-10 flex-1 px-6 pb-24 pt-32 sm:px-10 sm:pt-36 lg:px-14">
        {/* Scratch space — put experiments here. */}
      </div>
    </section>
  );
}
