import React from "react";

function TeamCard({ image, name, title }) {
  return (
    <figure className="bg-gray-100 rounded-2xl p-8 shadow-md w-72">
      <img
        className="w-48 h-48 object-cover rounded-full -mt-16 mx-auto"
        src={image}
        alt={name}
      />
      <figcaption className="text-center font-body">
        <div className="font-body font-medium text-lg md:text-xl pt-4">
          {name}
        </div>
        <div className="text-base">{title}</div>
      </figcaption>
    </figure>
  );
}

export default TeamCard;
