"use client";

import "./globals.css";
import { StarknetConfig } from "@starknet-react/core";
import { ApolloProvider, ApolloClient, InMemoryCache } from "@apollo/client";
import { connectors } from "./lib/connectors";
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const client = new ApolloClient({
    // uri: "https://p01--loot-survivor-graphql--cwpz4gs4p7vn.code.run/goerli-graphql",
    uri: "http://localhost:8080/goerli-graphql",
    cache: new InMemoryCache(),
  });

  return (
    <html lang="en">
      <head>
        <title>Loot Survivors</title>
      </head>
      <body
        suppressHydrationWarning={true}
        className="text-terminal-green bg-conic-to-br to-terminal-black from-terminal-black bg-b bezel-container"
      >
        <img
          src="/crt_green_mask.png"
          alt="crt green mask"
          className="absolute w-full pointer-events-none crt-frame hidden sm:block"
        />
        <StarknetConfig connectors={connectors} autoConnect>
          <ApolloProvider client={client}>{children}</ApolloProvider>
        </StarknetConfig>
      </body>
    </html>
  );
}
