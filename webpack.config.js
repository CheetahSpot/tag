const
    { CleanWebpackPlugin } = require("clean-webpack-plugin"),
    // HtmlWebpackInlineStylePlugin = require('html-webpack-inline-style-plugin'),
    HtmlWebpackPlugin = require("html-webpack-plugin")


module.exports = {
    "entry": {
        "spot": "./src/index.js"
    },
    "mode": "none",
    "module": {
        "rules": [
            {
                "enforce": "pre",
                "exclude": /node_modules/u,
                "loader": "eslint-loader",
                "options": { "fix": true },
                "test": /\.(js)$/u
            },
            {
                "loader": "babel-loader",
                "test": /\.js$/u
            },
            {
                "enforce": "pre",
                "exclude": /node_modules/u,
                "loader": "eslint-loader",
                "options": { "fix": true },
                "test": /\.(html)$/u
            },
            {
                "test": /\.(html)$/u,
                "options": { "minification": true },
                "loader": "html-loader"
            },
            {
                "test": /\.(gif|jpe?g|png)(\?.*)?$/iu,
                "use": [
                    {
                        "loader": "file-loader",
                        "options": {
                            "esModule": false,
                            "name": "images/[name].[ext]"
                        }
                    }
                ]
            }
        ]
    },
    "plugins": [
        new CleanWebpackPlugin({ "verbose": true }),
        // new HtmlWebpackPlugin({
        //     "filename": "cart.html",
        //     "inject": "head",
        //     "template": "src/html/cart.html"
        // }),
        // new HtmlWebpackPlugin({
        //     "filename": "cust100.html",
        //     "inject": "head",
        //     "template": "src/html/cust100.html"
        // }),
        // new HtmlWebpackPlugin({
        //     "filename": "growingtree.html",
        //     "inject": "head",
        //     "template": "src/html/growingtree.html"
        // }),
        new HtmlWebpackPlugin({
            "filename": "gtm.html",
            "inject": false,
            "template": "src/html/gtm.html"
        }),
        new HtmlWebpackPlugin({
            "filename": "index.html",
            "inject": false,
            "template": "src/html/index.html"
        }),
        new HtmlWebpackPlugin({
            "filename": "inline.html",
            "inject": false,
            "template": "src/html/inline.html"
        }),
        // new HtmlWebpackInlineStylePlugin({
        //     juiceOptions: {
        //         applyAttributesTableElements: false,
        //         applyHeightAttributes: false,
        //         applyStyleTags: false,
        //         applyWidthAttributes: false,
        //         extraCss: "",
        //         insertPreservedExtraCss: false,
        //         inlinePseudoElements: false,
        //         preserveFontFaces: false,
        //         preserveImportant: false,
        //         preserveMediaQueries: false,
        //         preserveKeyFrames: false,
        //         preservePseudos: false,
        //         removeStyleTags: false,
        //         webResources: {},
        //         xmlMode: false
        //     }
        // }),
    ],
    "output": {
        "ecmaVersion": 5
    }
}
