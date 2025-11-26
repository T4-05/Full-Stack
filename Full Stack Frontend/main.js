const { createApp, ref, computed, watch } = Vue;

const app = createApp({
    setup() {
        // ============================================================
        // APP STATE (The data our app needs to track)
        // ============================================================
        const sitename = ref('Lesson Shop');
        const lessons = ref([]); // Start with an empty list; we fill this from the DB later
        const cart = ref([]);    // Stores the lessons the user wants to buy
        
        // I used a simple string to track which page is active ('home', 'lessons', or 'cart')
        // This lets me switch views without needing a complex router.
        const currentPage = ref('home'); 
        
        // Sorting and Searching state
        const sortAttribute = ref('subject'); // Default sort by Subject
        const sortOrder = ref('asc');         // Default to Ascending order
        const searchQuery = ref('');          // Stores what the user types in the search bar
        
        // Checkout form data
        const checkoutForm = ref({ name: '', phone: '' });

        // !! IMPORTANT: Connection to the Back-End
        // This points to my live server on Render. If running locally, I'd switch this to localhost:3000.
        const serverUrl = ref('https://full-stack-render-2gxd.onrender.com'); 
        
        // ============================================================
        // API FUNCTIONS (Talking to the Server)
        // ============================================================
        
        // Fetches all lessons from MongoDB when the app loads
        const fetchLessons = async () => {
            try {
                // Request data from my GET /lessons route
                const response = await fetch(`${serverUrl.value}/lessons`);
                lessons.value = await response.json(); // Update the Vue state with the results
            } catch (error) {
                console.error("Failed to fetch lessons:", error);
            }
        };

        // Handles the search functionality
        const searchLessons = async (query) => {
            try {
                // If the search bar is cleared, just load all lessons again
                if (!query) {
                    fetchLessons();
                    return;
                }
                // Otherwise, ask the backend to filter results
                const response = await fetch(`${serverUrl.value}/search?q=${query}`);
                lessons.value = await response.json();
            } catch (error) {
                console.error("Failed to search lessons:", error);
            }
        };

        // Trigger the initial fetch so the user sees content immediately
        fetchLessons();

        // "Watch" the search bar. As soon as the user types, we trigger a search.
        // This creates a nice "search-as-you-type" experience.
        watch(searchQuery, (newQuery) => {
            searchLessons(newQuery);
        });

        // ============================================================
        // COMPUTED PROPERTIES (Auto-updating logic)
        // ============================================================
        
        // Automatically counts items in the cart for the badge button
        const cartItemCount = computed(() => cart.value.length);

        // Logic to sort the lessons array based on user selection
        const sortedLessons = computed(() => {
            // We create a copy so we don't mutate the original array directly
            const lessonsCopy = [...lessons.value]; 
            
            return lessonsCopy.sort((a, b) => {
                let aValue = a[sortAttribute.value];
                let bValue = b[sortAttribute.value];
                
                // If sorting by text (like Subject/Location), make it case-insensitive
                if (typeof aValue === 'string') {
                    aValue = aValue.toLowerCase();
                    bValue = bValue.toLowerCase();
                }

                // Handle Ascending vs Descending logic
                if (aValue < bValue) {
                    return sortOrder.value === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortOrder.value === 'asc' ? 1 : -1;
                }
                return 0;
            });
        });

        // Validation: Checks if Name contains only letters and Phone contains only numbers
        const isCheckoutFormValid = computed(() => {
            const nameRegex = /^[A-Za-z\s]+$/; // Only letters and spaces
            const phoneRegex = /^\d+$/;        // Only digits
            return nameRegex.test(checkoutForm.value.name) && phoneRegex.test(checkoutForm.value.phone);
        });

        // ============================================================
        // METHODS (User Actions)
        // ============================================================
        
        const addToCart = (lesson) => {
            // Only allow adding if there is actually space left
            if (lesson.spaces > 0) {
                // Find the specific lesson object in our main list
                const lessonInList = lessons.value.find(l => l._id === lesson._id);
                
                if (lessonInList) {
                    // Add a copy to the cart and decrease available space on the screen
                    cart.value.push({ ...lesson });
                    lessonInList.spaces--; 
                }
            }
        };

        const removeFromCart = (cartItem) => {
            // When removing, we must "return" the space back to the lesson
            const originalLesson = lessons.value.find(lesson => lesson._id === cartItem._id);
            if (originalLesson) {
                originalLesson.spaces++;
            }
            
            // Find and remove only the specific instance from the cart
            const cartIndex = cart.value.findIndex(item => item._id === cartItem._id);
            if (cartIndex !== -1) {
                cart.value.splice(cartIndex, 1);
            }
        };

        // Finalizes the purchase
        const submitOrder = async () => {
            if (!isCheckoutFormValid.value) return; // Double check validation

            // 1. Prepare the data object for the 'orders' collection
            const order = {
                name: checkoutForm.value.name,
                phone: checkoutForm.value.phone,
                // Extract just the IDs for the order record
                lessons: cart.value.map(item => item._id) 
            };

            // 2. Calculate the new space counts for MongoDB
            // We need to tell the database: "For Lesson X, the new space count is Y"
            const spaceUpdates = cart.value.reduce((acc, item) => {
                if (!acc[item._id]) {
                    const originalLesson = lessons.value.find(l => l._id === item._id);
                    acc[item._id] = { spaces: originalLesson.spaces }; 
                }
                return acc;
            }, {});

            try {
                // 3. Send the POST request to create the order
                await fetch(`${serverUrl.value}/orders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(order)
                });

                // 4. Send PUT requests to update the spaces for *each* unique lesson in the cart
                const updatePromises = Object.entries(spaceUpdates).map(([lessonId, update]) =>
                    fetch(`${serverUrl.value}/lessons/${lessonId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(update)
                    })
                );
                
                // Wait for all updates to finish
                await Promise.all(updatePromises);

                // 5. Success! Reset the form and cart
                alert('Order submitted successfully!');
                cart.value = [];
                checkoutForm.value.name = '';
                checkoutForm.value.phone = '';
                currentPage.value = 'home'; // Send user back to the homepage

            } catch (error) {
                console.error("Failed to submit order:", error);
                alert("There was an error submitting your order. Please try again.");
            }
        };

        // Expose everything to the HTML template
        return {
            sitename,
            lessons,
            cart,
            currentPage, 
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
        };
    }
});

// ============================================================
// COMPONENTS
// ============================================================

// Reusable component to display the grid of lessons
app.component('lesson-list', {
    props: ['lessons'],
    emits: ['addToCart'],
    template: `
        <div class="lesson-grid">
            <div v-for="lesson in lessons" :key="lesson._id" class="lesson-card">
                
                <div class="lesson-header">
                    <figure>
                        <img v-bind:src="'https://full-stack-render-2gxd.onrender.com/Images/' + lesson.image" alt="Lesson Image">
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

// Component for the Shopping Cart view and Checkout form
app.component('shopping-cart', {
    props: ['cart'],
    emits: ['removeFromCart', 'submitOrder'],
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
                    </button>
                </div>
            </div>
        </div>
    `
});

// Mount the Vue application to the HTML div with id="app"
app.mount('#app');