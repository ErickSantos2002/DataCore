import React, { useState, useLayoutEffect } from "react";
import logo from "../assets/logo.png";

const Home: React.FC = () => {
  const [altura, setAltura] = useState("100dvh");

  // Calcula dinamicamente a altura disponível, considerando header
  useLayoutEffect(() => {
    const ajustarAltura = () => {
      const header = document.querySelector("header");
      const headerAltura = header ? header.clientHeight : 0;
      const alturaViewport =
        window.innerHeight || document.documentElement.clientHeight;
      setAltura(`${alturaViewport - headerAltura}px`);
    };

    ajustarAltura();
    window.addEventListener("resize", ajustarAltura);
    return () => window.removeEventListener("resize", ajustarAltura);
  }, []);

  return (
    <div
      className="flex flex-col bg-surface transition-colors"
      style={{
        height: altura,
        overflow: "hidden",
      }}
    >
      {/* Logo centralizada e responsiva */}
      <div className="flex flex-1 items-center justify-center overflow-hidden">
        <img
          src={logo}
          alt="Logo Health & Safety"
          className="h-auto w-[70%] max-w-[950px] object-contain sm:w-[80%] md:w-[60%]"
          style={{
            maxHeight: "80%",
          }}
        />
      </div>

      {/* Rodapé colado no fundo */}
      <footer className="flex w-full flex-col items-center justify-center gap-1 bg-surface px-4 py-3.5 text-center shadow transition-colors sm:flex-row sm:gap-3">
        <p className="text-sm font-medium text-conteudo sm:text-base">
          © {new Date().getFullYear()} Health Safety — Todos os direitos
          reservados.
        </p>
      </footer>
    </div>
  );
};

export default Home;
