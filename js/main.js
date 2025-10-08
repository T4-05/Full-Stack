// 1. ADDED THIS DATA ARRAY AT THE TOP
const lessonsData = [
    { _id: 101, subject: 'Mathematics', location: 'Hendon', price: 100, spaces: 5, icon: 'fas fa-calculator' },
    { _id: 102, subject: 'English Language', location: 'Colindale', price: 90, spaces: 5, icon: 'fas fa-book-open' },
    { _id: 103, subject: 'Chemistry', location: 'Brent Cross', price: 115, spaces: 5, icon: 'fas fa-flask' },
    { _id: 104, subject: 'History', location: 'Golders Green', price: 85, spaces: 5, icon: 'fas fa-landmark' },
    { _id: 105, subject: 'Computer Science', location: 'Hendon', price: 125, spaces: 5, icon: 'fas fa-laptop-code' },
    { _id: 106, subject: 'Physics', location: 'Mill Hill', price: 110, spaces: 5, icon: 'fas fa-atom' },
    { _id: 107, subject: 'Art & Design', location: 'Colindale', price: 75, spaces: 5, icon: 'fas fa-palette' },
    { _id: 108, subject: 'Geography', location: 'Wembley', price: 95, spaces: 5, icon: 'fas fa-globe-europe' },
    { _id: 109, subject: 'Music', location: 'Golders Green', price: 80, spaces: 5, icon: 'fas fa-music' },
    { _id: 110, subject: 'Biology', location: 'Brent Cross', price: 115, spaces: 5, icon: 'fas fa-dna' }
];

const { createApp, ref, computed, watch } = Vue;

const app = createApp({
    setup() {
        // STATE (data)
        const sitename = ref('Lesson Shop');
        // 2. MODIFIED THIS LINE to use the local lessonsData array
        const lessons = ref(lessonsData);
        const cart = ref([]);
        const showCart = ref(false);
        const sortAttribute = ref('subject');
        const sortOrder = ref('asc');
        const searchQuery = ref('');
        const checkoutForm = ref({ name: '', phone: '' });
        // !! IMPORTANT: Replace this with your actual Render/AWS server URL
        const serverUrl = ref('https://cw2-backend-api.onrender.com'); 

        // API Fetch Functions
        const fetchLessons = async () => {
            try {
                const response = await fetch(`${serverUrl.value}/lessons`);
                lessons.value = await response.json();
            } catch (error) {
                console.error("Failed to fetch lessons:", error);
            }
        };

        const searchLessons = async (query) => {
            try {
                // Do not search if query is empty, just fetch all
                if (!query) {
                    fetchLessons();
                    return;
                }
                const response = await fetch(`${serverUrl.value}/search?q=${query}`);
                lessons.value = await response.json();
            } catch (error) {
                console.error("Failed to search lessons:", error);
            }
        };

        // 3. COMMENTED OUT THIS LINE to prevent overwriting local data
        // fetchLessons();

        // Watch for changes in the search query and trigger a search
        // This implements "search as you type"
        watch(searchQuery, (newQuery) => {
            searchLessons(newQuery);
        });

        // COMPUTED PROPERTIES
        const cartItemCount = computed(() => cart.value.length);

        const sortedLessons = computed(() => {
            const lessonsCopy = [...lessons.value];
            return lessonsCopy.sort((a, b) => {
                let aValue = a[sortAttribute.value];
                let bValue = b[sortAttribute.value];
                
                // Handle numeric vs string sorting
                if (typeof aValue === 'string') {
                    aValue = aValue.toLowerCase();
                    bValue = bValue.toLowerCase();
                }

                if (aValue < bValue) {
                    return sortOrder.value === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortOrder.value === 'asc' ? 1 : -1;
                }
                return 0;
            });
        });

        const isCheckoutFormValid = computed(() => {
            const nameRegex = /^[A-Za-z\s]+$/;
            const phoneRegex = /^\d+$/;
            return nameRegex.test(checkoutForm.value.name) && phoneRegex.test(checkoutForm.value.phone);
        });

        // METHODS
        const toggleCartView = () => {
            showCart.value = !showCart.value;
        };

        const addToCart = (lesson) => {
            if (lesson.spaces > 0) {
                cart.value.push({ ...lesson });
                lesson.spaces--;
            }
        };

        const removeFromCart = (cartItem) => {
            // Find the original lesson in the main list to update its spaces
            const originalLesson = lessons.value.find(lesson => lesson._id === cartItem._id);
            if (originalLesson) {
                originalLesson.spaces++;
            }
            // Remove the first instance of this item from the cart
            const cartIndex = cart.value.findIndex(item => item._id === cartItem._id);
            if (cartIndex !== -1) {
                cart.value.splice(cartIndex, 1);
            }
        };

        const submitOrder = async () => {
            if (!isCheckoutFormValid.value) return;

            // 1. Prepare the order payload
            const order = {
                name: checkoutForm.value.name,
                phone: checkoutForm.value.phone,
                lessons: cart.value.map(item => ({
                    lessonId: item._id,
                    spaces: 1 // Assuming 1 space per cart item
                }))
            };

            // 2. Prepare space updates
            const spaceUpdates = cart.value.reduce((acc, item) => {
                if (!acc[item._id]) {
                    const originalLesson = lessons.value.find(l => l._id === item._id);
                    acc[item._id] = { spaces: originalLesson.spaces }; // Send the final space count
                }
                return acc;
            }, {});

            try {
                // 3. POST the new order
                await fetch(`${serverUrl.value}/orders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(order)
                });

                // 4. PUT updates for each lesson's spaces
                const updatePromises = Object.entries(spaceUpdates).map(([lessonId, update]) =>
                    fetch(`${serverUrl.value}/lessons/${lessonId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(update)
                    })
                );
                
                await Promise.all(updatePromises);

                // 5. On success, show confirmation and reset state
                alert('Order submitted successfully!');
                cart.value = [];
                checkoutForm.value.name = '';
                checkoutForm.value.phone = '';
                showCart.value = false;

            } catch (error) {
                console.error("Failed to submit order:", error);
                alert("There was an error submitting your order. Please try again.");
            }
        };

        return {
            sitename,
            lessons,
            cart,
            showCart,
            sortAttribute,
            sortOrder,
            searchQuery,
            checkoutForm,
            cartItemCount,
            sortedLessons,
            isCheckoutFormValid,
            toggleCartView,
            addToCart,
            removeFromCart,
            submitOrder
        };
    }
});

// Component for displaying the list of lessons (corresponds to lesson.vue)
app.component('lesson-list', {
    props: ['lessons'],
    emits: ['addToCart'],
    template: `
        <div class="lesson-grid">
            <div v-for="lesson in lessons" :key="lesson._id" class="lesson-card">
                <div class="lesson-header">
                    <i :class="lesson.icon"></i>
                    <h2>{{ lesson.subject }}</h2>
                </div>
                <div class="lesson-details">
                    <p><strong>Location:</strong> {{ lesson.location }}</p>
                    <p><strong>Price:</strong> £{{ lesson.price }}</p>
                    <p><strong>Spaces:</strong> {{ lesson.spaces }}</p>
                </div>
                <button @click="$emit('addToCart', lesson)" :disabled="lesson.spaces === 0" class="add-to-cart-btn">
                    Add to Cart
                </button>
            </div>
        </div>
    `
});

// Component for the shopping cart and checkout (corresponds to cart.vue)
app.component('shopping-cart', {
    props: ['cart'],
    emits: ['removeFromCart', 'submitOrder'],
    setup(props, { emit }) {
        const checkoutForm = ref({ name: '', phone: '' });

        const isCheckoutFormValid = computed(() => {
            const nameRegex = /^[A-Za-z\s]+$/;
            const phoneRegex = /^\d+$/;
            return nameRegex.test(checkoutForm.value.name) && phoneRegex.test(checkoutForm.value.phone);
        });

        const handleSubmit = () => {
            if (isCheckoutFormValid.value) {
                // We emit the form data up, but the main app instance handles the actual submission
                // This is to keep the logic that interacts with `lessons` state in one place.
                // An alternative would be to pass the entire submitOrder function as a prop.
                emit('submitOrder');
            }
        };

        return { checkoutForm, isCheckoutFormValid, handleSubmit };
    },
    template: `
        <div class="shopping-cart">
            <h2>Shopping Cart</h2>
            <div v-if="cart.length === 0">
                <p>Your cart is empty.</p>
            </div>
            <div v-else>
                <div v-for="item in cart" :key="item._id + '-' + Math.random()" class="cart-item">
                    <div>
                        <h3>{{ item.subject }}</h3>
                        <p>Location: {{ item.location }}</p>
                        <p>Price: £{{ item.price }}</p>
                    </div>
                    <button @click="$emit('removeFromCart', item)" class="remove-btn">Remove</button>
                </div>

                <div class="checkout-form">
                    <h2>Checkout</h2>
                    <div class="form-group">
                        <label for="name">Name:</label>
                        <input type="text" id="name" v-model="$parent.checkoutForm.name" placeholder="Letters only">
                    </div>
                    <div class="form-group">
                        <label for="phone">Phone:</label>
                        <input type="text" id="phone" v-model="$parent.checkoutForm.phone" placeholder="Numbers only">
                    </div>
                    <button @click="$emit('submitOrder')" :disabled="!$parent.isCheckoutFormValid" class="checkout-btn">
                        Checkout
                    </button>
                </div>
            </div>
        </div>
    `
});

// Mount the Vue application to the element with id="app"
app.mount('#app');