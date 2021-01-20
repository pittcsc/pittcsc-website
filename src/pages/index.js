import React from "react";

import Header from "../components/Header";
import Footer from "../components/Footer";
import heroImage from "../images/hero-img2-cropped.png";

const IndexPage = () => (
  <div>
    <Header />
    <main className="container mx-auto space-y-64 min-h-screen my-32">
      <section className="flex justify-center items-center">
        <div className="w-1/2">
          <p className="font-light text-lg font-body">2020-2021 SCHOOL YEAR</p>
          <h2 className="text-5xl font-bold font-body pb-8 pt-4">
            Pitt Computer Science Club
          </h2>
          <h3 className="font-body w-3/4">
            The University of Pittsburgh's largest CS-related student
            organization. Proudly pushing the boundaries on what it means to be
            a Pitt student.
          </h3>
          <div className="py-4 space-x-8">
            <button className="bg-primary font-body transition text-white font-bold py-2 px-4 rounded-full min-w-300 shadow-md hover:shadow-lg">
              Join the Club
            </button>
            <button className="border-4 font-body transition border-primary font-bold py-2 px-4 rounded-full min-w-300 shadow-md hover:shadow-lg">
              What We Do
            </button>
          </div>
        </div>
        <div className="w-1/2 flex justify-center items-center polka-background">
          <img className="w-9/12" src={heroImage} alt="pitt_csc_logo" />
        </div>
      </section>
      <section>
        <div>
          <h1>Mask Image</h1>
        </div>
        <div>
          <h3>Our Mission</h3>
          <p>
            To grow and strengthen the student developer community here at the
            University of Pittsburgh.
          </p>
        </div>
      </section>
      <section>
        <div>
          <h3>Hit us up</h3>
        </div>
        <div>
          <h3>Social stuff</h3>
        </div>
      </section>
      <section>
        <h3>Donate button not allowed</h3>
        <div>Caroseul?</div>
      </section>
    </main>
    <Footer />
  </div>
);

export default IndexPage;
