var TEST_PUBLISHABLE_KEY =
    "pk_test_51GyTXKHVuS89JQvcmrT9zbrYsUvfew3Pgc3BAnd4rchW0AclZrHJNFEqXA5wWlRL827IgngloFx0aZCUL672kmrK00fSvq0DPx";
var PUBLISHABLE_KEY =
    "pk_live_51GyTXKHVuS89JQvcAZyGipQ6casgDpkU7Rb2v9xQ8qi93unp5Oq3gvXPkqBNhvAa1nHsiRjZCL2KSdefSeWmellp003rFhO0Z6";

// The domain you want your users to be redirected back to after payment
var REDIRECT_DOMAIN = location.href;

var urlParams = new URLSearchParams(window.location.search);

if (urlParams.has("session_id")) {
    document.querySelector(".donation-wrapper").innerHTML =
        "Thank you for donating!";
}

var stripe = Stripe(PUBLISHABLE_KEY);

// Handle any errors from Checkout
var handleResult = function (result) {
    if (result.error) {
        console.error(result.error.message);
    }
    $moneyButtons.classList.add("hide");
};

var $moneyButtons = document.querySelector("#money-buttons");

document
    .querySelector(".donation-wrapper #donate-button")
    .addEventListener("click", function (e) {
        e.target.classList.add("hide");
        $moneyButtons.classList.remove("hide");
    });

$moneyButtons.querySelectorAll("button").forEach(function (button) {
    button.addEventListener("click", function (e) {
        var mode = "payment";
        var priceId = e.target.dataset.priceId;
        var items = [{ price: priceId, quantity: 1 }];

        // Make the call to Stripe.js to redirect to the checkout page
        // with the sku or plan ID.
        stripe
            .redirectToCheckout({
                mode: mode,
                lineItems: items,
                successUrl:
                    REDIRECT_DOMAIN + "?session_id={CHECKOUT_SESSION_ID}",
                cancelUrl:
                    REDIRECT_DOMAIN + "?session_id={CHECKOUT_SESSION_ID}",
            })
            .then(handleResult);
    });
});
