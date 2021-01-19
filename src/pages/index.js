import React from "react";

import Header from "../components/Header";
import Footer from "../components/Footer";

const IndexPage = () => (
  <div>
    <Header />
    <main className="container mx-auto space-y-16">
      <section>
        <div>
          <p className="font-light text-lg">2020-2021 SCHOOL YEAR</p>
          <h2 className="text-6xl font-bold py-4">
            Pitt Computer Science Club
          </h2>
          <h3>
            The University of Pittsburgh's largest CS-related student
            organization. Proudly pushing the boundaries on what it means to be
            a Pitt student.
          </h3>
          <div>
            <button>Join Us</button>
            <button>What We Do</button>
          </div>
        </div>
        <div>
          <h1>Image</h1>
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
