const { createApp, ref, computed, watch } = Vue;



const app = createApp({
    setup() {
        // === STATE (data) ===
        const sitename = ref('Lesson Shop');
        const lessons = ref([]); // Will be populated by fetch
        const cart = ref([]);
        
        // This now controls which page is visible: 'home', 'lessons', or 'cart'
        const currentPage = ref('home'); 
        
        const sortAttribute = ref('subject');
        const sortOrder = ref('asc');
        const searchQuery = ref('');
        const checkoutForm = ref({ name: '', phone: '' });

        // !! IMPORTANT: Use 'http://localhost:3000' for local testing
        // Change this to your Render URL before final deployment
        const serverUrl = ref('http://localhost:3000'); 
        
        // === API FETCH FUNCTIONS ===
        const fetchLessons = async () => {
            try {
                const response = await fetch(`${serverUrl.value}/lessons`);
                lessons.value = await response.json();
            } catch (error) {
                console.error("Failed to fetch lessons:", error);
                // Handle error, maybe show a message to the user
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

        // Fetch initial lessons when the app is created
        fetchLessons();

        // Watch for changes in the search query and trigger a search
        // This implements "search as you type"
        watch(searchQuery, (newQuery) => {
            searchLessons(newQuery);
        });

        // === COMPUTED PROPERTIES ===
        const cartItemCount = computed(() => cart.value.length);

        const sortedLessons = computed(() => {
            // Create a copy to avoid sorting the original array
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

        // === METHODS ===
        
        const addToCart = (lesson) => {
            if (lesson.spaces > 0) {
                // Find the lesson in the main 'lessons' array
                const lessonInList = lessons.value.find(l => l._id === lesson._id);
                if (lessonInList) {
                    cart.value.push({ ...lesson });
                    lessonInList.spaces--; // Decrease spaces in the main list
                }
            }
        };

        const removeFromCart = (cartItem) => {
            // Find the original lesson in the main list to update its spaces
            const originalLesson = lessons.value.find(lesson => lesson._id === cartItem._id);
            if (originalLesson) {
                originalLesson.spaces++;
            }
            
            // Find the *first* matching item in the cart to remove
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
                // Create an array of lesson IDs
                lessons: cart.value.map(item => item._id) 
            };

            // 2. Prepare space updates
            // This groups cart items by lesson ID to correctly update spaces
            const spaceUpdates = cart.value.reduce((acc, item) => {
                if (!acc[item._id]) {
                    // Find the lesson in the main list to get its *current* space count
                    const originalLesson = lessons.value.find(l => l._id === item._id);
                    acc[item._id] = { spaces: originalLesson.spaces }; // Send the final, reduced space count
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
                currentPage.value = 'home'; // Go back to the home page

            } catch (error) {
                console.error("Failed to submit order:", error);
                alert("There was an error submitting your order. Please try again.");
            }
        };

        // === RETURN VALUES ===
        // Expose state and methods to the template
        return {
            sitename,
            lessons,
            cart,
            currentPage, // Replaces showCart
            sortAttribute,
            sortOrder,
            searchQuery,
            checkoutForm,
            cartItemCount,
            sortedLessons,
            isCheckoutFormValid,
            addToCart,
            removeFromCart,
            submitOrder
            // toggleCartView is no longer needed
        };
    }
});

// === COMPONENTS ===

// Component for displaying the list of lessons
app.component('lesson-list', {
    props: ['lessons'],
    emits: ['addToCart'],
    template: `
        <div class="lesson-grid">
            <div v-for="lesson in lessons" :key="lesson._id" class="lesson-card">
                
                <div class="lesson-header">
                    <figure>
                        <img v-bind:src="'http://localhost:3000/' + lesson.image" alt="Lesson Image">
                    </figure>
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

// Component for the shopping cart and checkout
app.component('shopping-cart', {
    props: ['cart'],
    emits: ['removeFromCart', 'submitOrder'],
    // This component does not need its own 'setup' function
    // It will use the parent's state via v-model in the template
    template: `
        <div class="shopping-cart">
            <h2>Shopping Cart</h2>
            <div v-if="cart.length === 0">
                <p>Your cart is empty.</p>
            </div>
            <div v-else>
                <div v-for="(item, index) in cart" :key="item._id + '-' + index" class="cart-item">
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
                    </button>.
                </div>
            </div>
        </div>
    `
});

// Mount the Vue application
app.mount('#app');