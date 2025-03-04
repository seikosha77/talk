import fs from "fs";
import path from "path";
import errorOverlayMiddleware from "react-dev-utils/errorOverlayMiddleware";
import evalSourceMapMiddleware from "react-dev-utils/evalSourceMapMiddleware";
import ignoredFiles from "react-dev-utils/ignoredFiles";
import noopServiceWorkerMiddleware from "react-dev-utils/noopServiceWorkerMiddleware";
import { Configuration } from "webpack-dev-server";

import paths from "./paths";

interface WebpackDevServerConfig {
  allowedHost: any;
  /** The port of the Coral server */
  serverPort: number;
  /** The port of the Webpack Dev server */
  devPort: number;
  publicPath: string;
}

export default function ({
  allowedHost,
  serverPort,
  devPort,
  publicPath,
}: WebpackDevServerConfig): Configuration {
  return {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers":
        "X-Requested-With, content-type, Authorization",
    },
    stats: {
      // https://github.com/TypeStrong/ts-loader#transpileonly-boolean-defaultfalse
      // Using transpilation only without typechecks gives warnings when we reexport types.
      // We can ignore them here.
      warningsFilter: /export .* was not found in/,
    },
    // Enable gzip compression of generated files.
    compress: true,
    // Silence WebpackDevServer's own logs since they're generally not useful.
    // It will still show compile warnings and errors with this setting.
    clientLogLevel: "none",
    // By default WebpackDevServer serves physical files from current directory
    // in addition to all the virtual build products that it serves from memory.
    // This is confusing because those files won’t automatically be available in
    // production build folder unless we copy them. However, copying the whole
    // project directory is dangerous because we may expose sensitive files.
    // Instead, we establish a convention that only files in `public` directory
    // get served. Our build script will copy `public` into the `build` folder.
    // In `index.html`, you can get URL of `public` folder with %PUBLIC_URL%:
    // <link rel="shortcut icon" href="%PUBLIC_URL%/favicon.ico">
    // In JavaScript code, you can access it with `process.env.PUBLIC_URL`.
    // Note that we only recommend to use `public` folder as an escape hatch
    // for files like `favicon.ico`, `manifest.json`, and libraries that are
    // for some reason broken when imported through Webpack. If you just want to
    // use an image, put it in `src` and `import` it from JavaScript instead.
    contentBase: paths.appPublic,
    // By default files from `contentBase` will not trigger a page reload.
    watchContentBase: true,
    // Enable hot reloading server. It will provide /sockjs-node/ endpoint
    // for the WebpackDevServer client so it can learn when the files were
    // updated. The WebpackDevServer client is included as an entry point
    // in the Webpack development configuration. Note that only changes
    // to CSS are currently hot reloaded. JS changes will refresh the browser.
    hot: true,
    // It is important to tell WebpackDevServer to use the same "root" path
    // as we specified in the config. In development, we always serve from /.
    publicPath,
    // WebpackDevServer is noisy by default so we emit custom message instead
    // by listening to the compiler events with `compiler.plugin` calls above.
    quiet: true,
    // Reportedly, this avoids CPU overload on some systems.
    // https://github.com/facebookincubator/create-react-app/issues/293
    // src/node_modules is not ignored to support absolute imports
    // https://github.com/facebookincubator/create-react-app/issues/1065
    watchOptions: {
      ignored: ignoredFiles(paths.appSrc),
    },
    overlay: false,
    historyApiFallback: {
      disableDotRule: true,
      rewrites: [],
    },
    allowedHosts: ["127.0.0.1:8080", "127.0.0.1:3000"],
    public: "127.0.0.1:8080",
    index: "embed.html",
    sockPort: devPort,
    proxy: [
      {
        context: "/api/graphql/live",
        // Proxy websocket connections.
        target: `ws://localhost:${serverPort}`,
        ws: true,
      },
      {
        context: (pathname) => {
          const lc = pathname.toLocaleLowerCase();
          return [
            "/embed/auth",
            "/embed/bootstrap",
            "/admin",
            "/account",
            "/install",
            "/api",
            "/graphiql",
          ].some((p) => p === lc || lc.startsWith(`${p}/`));
        },
        target: `127.0.0.1:${serverPort}`,
        onError: (err, req, res) => {
          res.writeHead(500, {
            "Content-Type": "text/html",
          });
          res.end(
            fs.readFileSync(
              path.join(__dirname, "webpackDevServerProxyError.html")
            )
          );
          return;
        },
      },
    ],
    before(app, server) {
      // This lets us fetch source contents from webpack for the error overlay
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      app.use(evalSourceMapMiddleware(server));

      // This lets us open files from the runtime error overlay.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      app.use(errorOverlayMiddleware());
      // This service worker file is effectively a 'no-op' that will reset any
      // previous service worker registered for the same host:port combination.
      // We do this in development to avoid hitting the production cache if
      // it used the same host and port.
      // https://github.com/facebookincubator/create-react-app/issues/2272#issuecomment-302832432
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      app.use(noopServiceWorkerMiddleware());
    },
  };
}
